import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { rankableMarkets, realisedGains, standings, type Fill, type Settlement, type Standing } from "@/core/leaderboard";
import { D } from "@/core/money";
import type { Db } from "@/db/client";
import { ledger, markets, trades } from "@/db/schema";
import { seasonOf, weekOf, type Period } from "@/lib/periods";
import { listMembers } from "./members";

/** Every trade, oldest first, as core fills. At 10–50 players this is a few thousand rows. */
export async function loadFills(db: Db, memberId?: string): Promise<Fill[]> {
  const rows = await db
    .select({
      at: trades.createdAt,
      memberId: trades.memberId,
      marketId: trades.marketId,
      side: trades.side,
      kind: trades.kind,
      coins: trades.coins,
      shares: trades.shares,
    })
    .from(trades)
    .where(memberId ? eq(trades.memberId, memberId) : undefined)
    .orderBy(asc(trades.createdAt), asc(trades.id));
  return rows.map((r) => ({ ...r, shares: D(r.shares) }));
}

/**
 * Settled markets: when they settled, and what each player got back in
 * payouts and refunds. Seed returns and creator bonuses are not trading.
 */
export async function loadSettlements(db: Db): Promise<Settlement[]> {
  const [settled, rows] = await Promise.all([
    db
      .select({ id: markets.id, at: markets.settledAt })
      .from(markets)
      .where(and(inArray(markets.status, ["resolved", "cancelled"]), isNotNull(markets.settledAt))),
    db
      .select({ marketId: ledger.marketId, memberId: ledger.memberId, amount: ledger.amount })
      .from(ledger)
      .innerJoin(markets, eq(markets.id, ledger.marketId))
      .where(and(inArray(markets.status, ["resolved", "cancelled"]), inArray(ledger.reason, ["payout", "refund"]))),
  ]);
  const byMarket = new Map<string, Settlement & { paid: Map<string, bigint> }>(
    settled.map((m) => [m.id, { marketId: m.id, at: m.at!, paid: new Map<string, bigint>() }]),
  );
  for (const r of rows) {
    const s = byMarket.get(r.marketId!);
    if (s) s.paid.set(r.memberId, (s.paid.get(r.memberId) ?? 0n) + r.amount);
  }
  return [...byMarket.values()];
}

export interface Row extends Standing {
  nickname: string;
}

export interface Leaderboard {
  week: Row[];
  season: Row[];
  weekPeriod: Period;
  seasonPeriod: Period;
  asOf: Date;
}

/** Both boards, every active member listed (decision 011). */
export async function getLeaderboard(db: Db, now: Date = new Date()): Promise<Leaderboard> {
  const [fills, settlements, members] = await Promise.all([loadFills(db), loadSettlements(db), listMembers(db)]);
  const gains = realisedGains(fills, settlements);
  const rankable = rankableMarkets(fills);
  const ids = members.map((m) => m.id);
  const nick = new Map(members.map((m) => [m.id, m.nickname]));
  const board = (p: Period) =>
    standings(gains, rankable, ids, p.start, p.end).map((s) => ({ ...s, nickname: nick.get(s.memberId)! }));
  const weekPeriod = weekOf(now);
  const seasonPeriod = seasonOf(now);
  return { week: board(weekPeriod), season: board(seasonPeriod), weekPeriod, seasonPeriod, asOf: now };
}
