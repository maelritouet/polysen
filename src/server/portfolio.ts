import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { displayPercent, quoteSell, type Side } from "@/core/amm";
import { D, type Coins, type Dec } from "@/core/money";
import type { Db } from "@/db/client";
import { holdings } from "@/core/leaderboard";
import { ledger, markets } from "@/db/schema";
import { loadFills } from "./leaderboard";

/** One side of one market the member still holds shares in. */
export interface OpenPosition {
  marketId: string;
  question: string;
  closeAt: Date;
  side: Side;
  shares: Dec;
  /** What the shares still held cost, at their average price (decision 011). */
  cost: Coins;
  /** What selling every share right now would pay, in hundredths. */
  value: Coins;
  /** The market's YES percent, as shown (1–99). */
  percent: number;
}

/** A market the member traded on that is over: resolved or cancelled. */
export interface ClosedPosition {
  marketId: string;
  question: string;
  status: "resolved" | "cancelled";
  /** The result, for a resolved market. */
  outcome: "YES" | "NO" | null;
  /** Coins bet. */
  spent: Coins;
  /** Coins back: sales, payouts and refunds. */
  received: Coins;
  net: Coins;
  endedAt: Date;
}

export interface Portfolio {
  open: OpenPosition[];
  closed: ClosedPosition[];
  /** Sum of the open positions' values. */
  value: Coins;
  /** Sum of the open positions' costs. */
  cost: Coins;
  /** When the values were computed: pages use it as "now" for time labels. */
  asOf: Date;
}

/** Sale value, or 0 when the holding is too small to be worth a hundredth. */
function resaleValue(pool: { yes: Dec; no: Dec }, side: Side, shares: Dec): Coins {
  try {
    return quoteSell(pool, side, shares).proceeds;
  } catch {
    return 0n;
  }
}

/**
 * A member's positions. Each open one is valued at its resale price: what
 * "Tout vendre" would pay at the current pools, the same figure the sell form
 * quotes. Two holdings on one market are each valued alone, as if sold first.
 */
export async function getPortfolio(db: Db, memberId: string, now: Date = new Date()): Promise<Portfolio> {
  const [fills, settled] = await Promise.all([
    loadFills(db, memberId),
    db
      .select({
        marketId: ledger.marketId,
        question: markets.question,
        status: markets.status,
        outcome: markets.outcome,
        spent: sql<string>`coalesce(-sum(${ledger.amount}) filter (where ${ledger.reason} = 'bet'), 0)`,
        received: sql<string>`coalesce(sum(${ledger.amount}) filter (where ${ledger.reason} <> 'bet'), 0)`,
        endedAt: sql<string>`max(${ledger.createdAt})`,
      })
      .from(ledger)
      .innerJoin(markets, eq(markets.id, ledger.marketId))
      .where(
        and(
          eq(ledger.memberId, memberId),
          inArray(ledger.reason, ["bet", "sale", "payout", "refund"]),
          inArray(markets.status, ["resolved", "cancelled"]),
        ),
      )
      .groupBy(ledger.marketId, markets.id)
      .orderBy(desc(sql`max(${ledger.createdAt})`)),
  ]);

  // Cost = the average-cost basis of the shares still held (decision 011):
  // a partial sale's gain is already realised, so it isn't counted again here.
  const holding = holdings(fills);
  const tradedOn = [...new Set(fills.map((f) => f.marketId))];
  const live = tradedOn.length
    ? await db
        .select({ id: markets.id, question: markets.question, closeAt: markets.closeAt, poolYes: markets.poolYes, poolNo: markets.poolNo })
        .from(markets)
        .where(and(inArray(markets.id, tradedOn), eq(markets.status, "open")))
    : [];
  const byId = new Map(live.map((m) => [m.id, m]));
  // Most recently traded market first; YES before NO within a market.
  const recent = [...new Set(fills.map((f) => f.marketId).reverse())];
  const open: OpenPosition[] = [];
  for (const marketId of recent) {
    const m = byId.get(marketId);
    if (!m) continue;
    const pool = { yes: D(m.poolYes), no: D(m.poolNo) };
    for (const side of ["YES", "NO"] as const) {
      const h = holding(memberId, marketId, side);
      if (!h.shares.gt(0)) continue;
      open.push({
        marketId,
        question: m.question,
        closeAt: m.closeAt,
        side,
        shares: h.shares,
        cost: h.cost,
        value: resaleValue(pool, side, h.shares),
        percent: displayPercent(pool),
      });
    }
  }
  const closed = settled.map((r): ClosedPosition => {
    const spent = BigInt(r.spent);
    const received = BigInt(r.received);
    return {
      marketId: r.marketId!,
      question: r.question,
      status: r.status as ClosedPosition["status"],
      outcome: r.outcome,
      spent,
      received,
      net: received - spent,
      endedAt: new Date(r.endedAt),
    };
  });
  return {
    open,
    closed,
    value: open.reduce((s, o) => s + o.value, 0n),
    cost: open.reduce((s, o) => s + o.cost, 0n),
    asOf: now,
  };
}
