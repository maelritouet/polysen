import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Side } from "@/core/amm";
import type { Db } from "@/db/client";
import { markets, profiles, trades } from "@/db/schema";
import { visibleTo } from "./markets";

/**
 * The friends feed: what people just did, newest first. Built from the
 * tables that already exist (no feed table): trades and new markets.
 * Resolutions show when a market pays out. Every event follows the market visibility
 * rule, so a market waiting for a tagged member's approval never leaks.
 */
export type FeedEvent =
  | { kind: "market"; at: Date; memberId: string; nickname: string; marketId: string; question: string }
  | { kind: "resolved"; at: Date; memberId: string; nickname: string; marketId: string; question: string; outcome: Side }
  | {
      kind: "trade";
      at: Date;
      memberId: string;
      nickname: string;
      marketId: string;
      question: string;
      side: Side;
      tradeKind: "buy" | "sell";
      coins: bigint;
    };

export async function getFeed(db: Db, viewerId: string, limit = 20): Promise<FeedEvent[]> {
  const [tradeRows, marketRows, resolvedRows] = await Promise.all([
    db
      .select({
        at: trades.createdAt,
        memberId: trades.memberId,
        nickname: profiles.nickname,
        marketId: trades.marketId,
        question: markets.question,
        side: trades.side,
        tradeKind: trades.kind,
        coins: trades.coins,
      })
      .from(trades)
      .innerJoin(markets, eq(markets.id, trades.marketId))
      .innerJoin(profiles, eq(profiles.id, trades.memberId))
      .where(visibleTo(viewerId))
      .orderBy(desc(trades.id))
      .limit(limit),
    db
      .select({
        at: markets.createdAt,
        memberId: markets.creatorId,
        nickname: profiles.nickname,
        marketId: markets.id,
        question: markets.question,
      })
      .from(markets)
      .innerJoin(profiles, eq(profiles.id, markets.creatorId))
      .where(visibleTo(viewerId))
      .orderBy(desc(markets.createdAt))
      .limit(limit),
    db
      .select({
        at: markets.settledAt,
        memberId: markets.creatorId,
        nickname: profiles.nickname,
        marketId: markets.id,
        question: markets.question,
        outcome: markets.outcome,
      })
      .from(markets)
      .innerJoin(profiles, eq(profiles.id, markets.creatorId))
      .where(and(visibleTo(viewerId), eq(markets.status, "resolved"), isNotNull(markets.settledAt)))
      .orderBy(desc(markets.settledAt))
      .limit(limit),
  ]);
  const events: FeedEvent[] = [
    ...tradeRows.map((r) => ({ kind: "trade" as const, ...r })),
    ...marketRows.map((r) => ({ kind: "market" as const, ...r })),
    ...resolvedRows.map((r) => ({ kind: "resolved" as const, ...r, at: r.at!, outcome: r.outcome! })),
  ];
  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
