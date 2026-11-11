import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { markets, profiles, trades } from "@/db/schema";

/** One point of a price chart: a time (ms) and the YES probability (0..1) from then on. */
export interface PricePoint {
  t: number;
  p: number;
}

/**
 * Price history from `trades.prob_after`, starting at 50% when the market
 * opened. Probabilities are only drawn, never used for coins, so plain
 * numbers are fine here.
 */
export async function getPriceHistories(db: Db, marketIds: string[]): Promise<Map<string, PricePoint[]>> {
  const out = new Map<string, PricePoint[]>();
  if (!marketIds.length) return out;
  const opened = await db
    .select({ id: markets.id, createdAt: markets.createdAt })
    .from(markets)
    .where(inArray(markets.id, marketIds));
  for (const m of opened) out.set(m.id, [{ t: m.createdAt.getTime(), p: 0.5 }]);
  const rows = await db
    .select({ marketId: trades.marketId, t: trades.createdAt, p: trades.probAfter })
    .from(trades)
    .where(inArray(trades.marketId, marketIds))
    .orderBy(asc(trades.id));
  for (const r of rows) out.get(r.marketId)?.push({ t: r.t.getTime(), p: Number(r.p) });
  return out;
}

export async function getPriceHistory(db: Db, marketId: string): Promise<PricePoint[]> {
  return (await getPriceHistories(db, [marketId])).get(marketId) ?? [];
}

/** The probability at a past moment: the last point at or before it. */
export function probabilityAt(points: PricePoint[], t: number): number | null {
  let p: number | null = null;
  for (const pt of points) {
    if (pt.t > t) break;
    p = pt.p;
  }
  return p;
}

export interface ActivityRow {
  id: string;
  nickname: string;
  side: "YES" | "NO";
  kind: "buy" | "sell";
  coins: bigint;
  at: Date;
}

/** The latest trades on a market, newest first, with who made them. */
export async function getActivity(db: Db, marketId: string, limit = 30): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      id: trades.id,
      nickname: profiles.nickname,
      side: trades.side,
      kind: trades.kind,
      coins: trades.coins,
      at: trades.createdAt,
    })
    .from(trades)
    .innerJoin(profiles, eq(profiles.id, trades.memberId))
    .where(eq(trades.marketId, marketId))
    .orderBy(desc(trades.id))
    .limit(limit);
  return rows.map((r) => ({ ...r, id: r.id.toString() }));
}

export interface MarketStats {
  /** Coins traded, bets and sales, in hundredths. */
  volume: bigint;
  /** The same over the last 24 hours: what "Tendance" ranks by. */
  volume24h: bigint;
  /** Distinct members who traded. */
  players: number;
}

/** Volume and player counts for a set of markets, in one grouped query. */
export async function getMarketStats(db: Db, marketIds: string[], now: Date = new Date()): Promise<Map<string, MarketStats>> {
  const out = new Map<string, MarketStats>();
  for (const id of marketIds) out.set(id, { volume: 0n, volume24h: 0n, players: 0 });
  if (!marketIds.length) return out;
  const since = new Date(now.getTime() - 86_400_000);
  const rows = await db
    .select({
      marketId: trades.marketId,
      volume: sql<string>`sum(${trades.coins})`,
      volume24h: sql<string>`coalesce(sum(${trades.coins}) filter (where ${trades.createdAt} > ${since.toISOString()}::timestamptz), 0)`,
      players: sql<number>`count(distinct ${trades.memberId})::int`,
    })
    .from(trades)
    .where(inArray(trades.marketId, marketIds))
    .groupBy(trades.marketId);
  for (const r of rows) out.set(r.marketId, { volume: BigInt(r.volume), volume24h: BigInt(r.volume24h), players: r.players });
  return out;
}
