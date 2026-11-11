import type { Side } from "./amm";
import { coinsToDecimal, D, decimalToCoinsDown, type Coins, type Dec } from "./money";

/**
 * The leaderboard ranks realised trading profit (decision 011). A gain is
 * realised when shares leave a player's hands:
 *
 *   - on a sale: the coins received minus the average cost of the shares sold;
 *   - when the market settles (resolution or cancel): what the player is paid
 *     or refunded minus the cost of every share still held.
 *
 * Over a settled market, a player's realised gains add up to exactly
 * (sales + payouts + refunds − bets): nothing is counted twice or lost.
 * Drops, bonuses and seed returns are not trades, so they never appear.
 */

/** One trade, as stored in `trades`. */
export interface Fill {
  at: Date;
  memberId: string;
  marketId: string;
  side: Side;
  kind: "buy" | "sell";
  /** Coins paid (buy) or received (sell), hundredths. */
  coins: Coins;
  shares: Dec;
}

/** A market's settlement: when it happened, and each player's payout + refund rows summed. */
export interface Settlement {
  marketId: string;
  at: Date;
  paid: ReadonlyMap<string, Coins>;
}

export interface Gain {
  memberId: string;
  marketId: string;
  at: Date;
  /** Hundredths; negative for a loss. */
  amount: Coins;
}

/** What a player still holds on one side of one market, and what those shares cost. */
export interface Holding {
  shares: Dec;
  /** The average-cost basis of the shares held, hundredths. Never negative. */
  cost: Coins;
}

const key = (memberId: string, marketId: string, side: Side) => `${memberId}|${marketId}|${side}`;

function walk(fills: readonly Fill[], settlements: readonly Settlement[]) {
  const holdings = new Map<string, Holding>();
  const gains: Gain[] = [];
  const settledAt = new Map(settlements.map((s) => [s.marketId, s.at]));
  // Stable sort: fills given in insertion order keep it when times are equal.
  const ordered = [...fills].sort((a, b) => a.at.getTime() - b.at.getTime());

  for (const f of ordered) {
    const done = settledAt.get(f.marketId);
    if (done && f.at > done) continue; // impossible in practice: a settled market takes no trades
    const k = key(f.memberId, f.marketId, f.side);
    const h = holdings.get(k) ?? { shares: D(0), cost: 0n };
    if (f.kind === "buy") {
      holdings.set(k, { shares: h.shares.plus(f.shares), cost: h.cost + f.coins });
      continue;
    }
    // Selling everything takes the whole basis, so no rounding is ever left behind.
    const all = f.shares.gte(h.shares);
    const basis = all ? h.cost : decimalToCoinsDown(coinsToDecimal(h.cost).mul(f.shares).div(h.shares));
    holdings.set(k, { shares: all ? D(0) : h.shares.minus(f.shares), cost: h.cost - basis });
    gains.push({ memberId: f.memberId, marketId: f.marketId, at: f.at, amount: f.coins - basis });
  }

  for (const s of settlements) {
    const players = new Set(s.paid.keys());
    for (const k of holdings.keys()) {
      const [memberId, marketId] = k.split("|");
      if (marketId === s.marketId) players.add(memberId);
    }
    for (const memberId of players) {
      let cost = 0n;
      for (const side of ["YES", "NO"] as const) {
        const k = key(memberId, s.marketId, side);
        const h = holdings.get(k);
        if (h) {
          cost += h.cost;
          holdings.delete(k);
        }
      }
      gains.push({ memberId, marketId: s.marketId, at: s.at, amount: (s.paid.get(memberId) ?? 0n) - cost });
    }
  }
  return { gains, holdings };
}

/** Every realised gain or loss, one per sale and one per player per settled market. */
export function realisedGains(fills: readonly Fill[], settlements: readonly Settlement[]): Gain[] {
  return walk(fills, settlements).gains;
}

/**
 * What each player still holds on unsettled markets, with its average-cost
 * basis. Replays the fills once and returns a lookup.
 */
export function holdings(fills: readonly Fill[]): (memberId: string, marketId: string, side: Side) => Holding {
  const map = walk(fills, []).holdings;
  return (memberId, marketId, side) => map.get(key(memberId, marketId, side)) ?? { shares: D(0), cost: 0n };
}

/** A market counts for the leaderboard once at least this many different people have traded on it. */
export const MIN_PLAYERS = 3;

/** Markets with at least MIN_PLAYERS traders: the only ones that count (anti second-account rule). */
export function rankableMarkets(fills: readonly Fill[]): Set<string> {
  const players = new Map<string, Set<string>>();
  for (const f of fills) {
    const set = players.get(f.marketId) ?? new Set<string>();
    set.add(f.memberId);
    players.set(f.marketId, set);
  }
  return new Set([...players].filter(([, p]) => p.size >= MIN_PLAYERS).map(([id]) => id));
}

export interface Standing {
  memberId: string;
  profit: Coins;
  /** 1 for the best; equal profits share a rank (1, 1, 3). */
  rank: number;
}

/**
 * Ranks members by the gains realised in [from, to) on rankable markets.
 * Every member in `members` gets a row, at 0 if they realised nothing.
 */
export function standings(
  gains: readonly Gain[],
  rankable: ReadonlySet<string>,
  members: readonly string[],
  from: Date,
  to: Date,
): Standing[] {
  const profit = new Map<string, Coins>(members.map((m) => [m, 0n]));
  for (const g of gains) {
    if (!rankable.has(g.marketId) || g.at < from || g.at >= to || !profit.has(g.memberId)) continue;
    profit.set(g.memberId, profit.get(g.memberId)! + g.amount);
  }
  const rows = [...profit].map(([memberId, p]) => ({ memberId, profit: p }));
  rows.sort((a, b) => (a.profit === b.profit ? a.memberId.localeCompare(b.memberId) : a.profit > b.profit ? -1 : 1));
  // Sorted best first, so a member's rank is 1 + the index of the first row with the same profit.
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || rows[i - 1].profit !== r.profit) rank = i + 1;
    return { ...r, rank };
  });
}
