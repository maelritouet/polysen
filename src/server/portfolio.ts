import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { displayPercent, quoteSell, type Side } from "@/core/amm";
import { D, type Coins, type Dec } from "@/core/money";
import type { Db } from "@/db/client";
import { ledger, markets, trades } from "@/db/schema";

/** One side of one market the member still holds shares in. */
export interface OpenPosition {
  marketId: string;
  question: string;
  closeAt: Date;
  side: Side;
  shares: Dec;
  /** Coins put in on this side minus coins taken out by sales (can go below zero). */
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
  const signed = (col: typeof trades.shares | typeof trades.coins) =>
    sql`sum(case when ${trades.kind} = 'buy' then ${col} else -${col} end)`;

  const [held, settled] = await Promise.all([
    db
      .select({
        marketId: trades.marketId,
        side: trades.side,
        shares: sql<string>`${signed(trades.shares)}`,
        cost: sql<string>`${signed(trades.coins)}`,
        question: markets.question,
        closeAt: markets.closeAt,
        poolYes: markets.poolYes,
        poolNo: markets.poolNo,
      })
      .from(trades)
      .innerJoin(markets, eq(markets.id, trades.marketId))
      .where(and(eq(trades.memberId, memberId), eq(markets.status, "open")))
      .groupBy(trades.marketId, trades.side, markets.id)
      .having(sql`${signed(trades.shares)} > 0`)
      // Most recently traded market first; YES before NO within a market.
      .orderBy(desc(sql`max(max(${trades.createdAt})) over (partition by ${trades.marketId})`), trades.marketId, trades.side),
    db
      .select({
        marketId: ledger.marketId,
        question: markets.question,
        status: markets.status,
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

  const open = held.map((r): OpenPosition => {
    const pool = { yes: D(r.poolYes), no: D(r.poolNo) };
    const shares = D(r.shares);
    return {
      marketId: r.marketId,
      question: r.question,
      closeAt: r.closeAt,
      side: r.side,
      shares,
      cost: BigInt(r.cost),
      value: resaleValue(pool, r.side, shares),
      percent: displayPercent(pool),
    };
  });
  const closed = settled.map((r): ClosedPosition => {
    const spent = BigInt(r.spent);
    const received = BigInt(r.received);
    return {
      marketId: r.marketId!,
      question: r.question,
      status: r.status as ClosedPosition["status"],
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
