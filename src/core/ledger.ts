import type { Coins } from "./money";

/**
 * The ledger is the only source of truth for coins: every movement is one
 * append-only row, and a balance is the sum of a member's rows. Nothing ever
 * edits a balance directly.
 */

/** Every reason a coin can move. The database enum is built from this list. */
export const LEDGER_REASONS = [
  "grant", // starting balance
  "drop", // daily drop, streak bonus included
  "bet", // negative: coins into a market
  "sale", // positive: coins out of a market from selling shares
  "payout", // positive: winning shares paid at resolution
  "refund", // a cancelled market unwinding (negative when profit is taken back)
  "creator_bonus", // a new player bet on your market
  "seed", // negative: the creator's 100 coins opening a market
  "seed_return", // the creator's share of the pool at resolution or cancel
] as const;

export type LedgerReason = (typeof LEDGER_REASONS)[number];

export interface LedgerEntry {
  memberId: string;
  /** Hundredths of a coin. */
  amount: Coins;
  reason: LedgerReason;
  marketId?: string;
}

// Coin rules from the PRD. All amounts in hundredths.
export const STARTING_GRANT: Coins = 100000n; // 1,000 coins
export const DAILY_DROP: Coins = 5000n; // 50 coins
export const STREAK_STEP: Coins = 1000n; // +10 coins per consecutive day
export const STREAK_MAX_BONUS: Coins = 5000n; // up to +50 coins
export const MARKET_SEED: Coins = 10000n; // 100 coins to launch a market
export const CREATOR_BONUS: Coins = 1000n; // 10 coins per new player on your market

export function balanceOf(entries: Iterable<LedgerEntry>, memberId: string): Coins {
  let total = 0n;
  for (const e of entries) if (e.memberId === memberId) total += e.amount;
  return total;
}

/** A positive amount that leaves the balance at zero or above. */
export function canSpend(balance: Coins, amount: Coins): boolean {
  return amount > 0n && amount <= balance;
}

/**
 * Drop for the given streak length (1 = first day, or first day after a gap):
 * 50 coins, plus 10 per consecutive day after the first, bonus capped at 50.
 */
export function dailyDropAmount(streakDays: number): Coins {
  if (!Number.isInteger(streakDays) || streakDays < 1) {
    throw new Error(`Invalid streak length: ${streakDays}`);
  }
  const bonus = STREAK_STEP * BigInt(streakDays - 1);
  return DAILY_DROP + (bonus < STREAK_MAX_BONUS ? bonus : STREAK_MAX_BONUS);
}

const TRADING_REASONS: ReadonlySet<LedgerReason> = new Set(["bet", "sale", "payout", "refund"]);

/** Leaderboards rank trading only: drops, bonuses and the creator's seed never count. */
export function isTradingReason(reason: LedgerReason): boolean {
  return TRADING_REASONS.has(reason);
}

export function tradingProfit(entries: Iterable<LedgerEntry>, memberId: string): Coins {
  let total = 0n;
  for (const e of entries) if (e.memberId === memberId && isTradingReason(e.reason)) total += e.amount;
  return total;
}
