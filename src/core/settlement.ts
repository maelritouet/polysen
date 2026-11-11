import type { Pool, Side } from "./amm";
import { creatorBonus } from "./ledger";
import { coinsToDecimal, D, decimalToCoinsDown, type Coins, type Dec } from "./money";

/**
 * Settling a market: paying it out (resolution) or unwinding it (cancel).
 * Both return the coin movements to write to the ledger. Their total always
 * equals the coins in the market, so a settled market nets to exactly zero.
 */

export interface Position {
  /** YES shares the player holds. */
  yes: Dec;
  /** NO shares the player holds. */
  no: Dec;
  /** Coins bet minus coins received from sales. Negative if they sold at a profit. */
  invested: Coins;
}

export interface MarketBook {
  pool: Pool;
  /** The creator's seed, in hundredths (100 coins = 10000n). */
  seed: Coins;
  creatorId: string;
  positions: ReadonlyMap<string, Position>;
}

export interface Transfer {
  memberId: string;
  /** Hundredths. Negative only for a cancel taking back profit already taken. */
  amount: Coins;
  reason: "payout" | "refund" | "seed_return" | "creator_bonus";
}

/** Coins in the market: the seed, plus every bet, minus every sale. */
export function coinsIn(book: MarketBook): Coins {
  let total = book.seed;
  for (const p of book.positions.values()) total += p.invested;
  return total;
}

/**
 * Every coin in the market minted one YES and one NO share, so on each side
 * the pool's shares plus the players' shares must equal the coins in, exactly.
 * If not, something upstream is wrong: refuse to move any coins.
 */
export function checkBook(book: MarketBook): void {
  const c = coinsToDecimal(coinsIn(book));
  let yes = book.pool.yes;
  let no = book.pool.no;
  for (const p of book.positions.values()) {
    if (p.yes.isNegative() || p.no.isNegative()) throw new Error("A position holds negative shares");
    yes = yes.plus(p.yes);
    no = no.plus(p.no);
  }
  if (!yes.eq(c) || !no.eq(c)) {
    throw new Error(`Book does not balance: ${c} coins in, ${yes} YES and ${no} NO shares`);
  }
}

/**
 * Pays a resolved market (decision 007).
 *
 * 1. Each winner gets 1 coin per winning share, rounded down to the hundredth.
 * 2. What is left (L) is the pool's winning shares plus the rounding dust.
 *    If L is at most the seed, the crowd was right and the creator gets L back.
 * 3. Otherwise the crowd lost S = L − seed to the pool. The creator gets the
 *    seed + 1% of S; the rest of S goes to the winners in proportion to their
 *    winning shares (or, if nobody won, back to the players in proportion to
 *    what they put in). Rounding dust from that split goes to the creator.
 * 4. The creator bonus: 1% of bets − sales, rounded down. These are new coins,
 *    outside the market, so they are not part of what the market pays out.
 *
 * Every transfer is ≥ 0, and all of them except the bonus add up to the
 * coins in the market.
 */
export function resolvePayouts(book: MarketBook, outcome: Side): Transfer[] {
  checkBook(book);
  const coins = coinsIn(book);
  const winners: Array<{ memberId: string; shares: Dec; amount: Coins }> = [];
  let basePaid = 0n;
  for (const [memberId, p] of book.positions) {
    const shares = outcome === "YES" ? p.yes : p.no;
    const amount = decimalToCoinsDown(shares);
    if (shares.gt(0)) winners.push({ memberId, shares, amount });
    basePaid += amount;
  }

  const leftover = coins - basePaid;
  let creatorBack = leftover;
  const extras: Transfer[] = [];
  if (leftover > book.seed) {
    const surplus = leftover - book.seed;
    const creatorCut = surplus / 100n; // 1%, rounded down
    const toShare = surplus - creatorCut;
    let shared = 0n;
    const totalShares = winners.reduce((s, w) => s.plus(w.shares), D(0));
    if (totalShares.gt(0)) {
      for (const w of winners) {
        const extra = BigInt(w.shares.mul(toShare.toString()).div(totalShares).floor().toFixed(0));
        w.amount += extra;
        shared += extra;
      }
    } else {
      // Nobody won, so the pool holds every coin and surplus = bets − sales > 0:
      // at least one player has coins in. Give the surplus back pro rata.
      let putIn = 0n;
      for (const p of book.positions.values()) if (p.invested > 0n) putIn += p.invested;
      for (const [memberId, p] of book.positions) {
        if (p.invested <= 0n) continue;
        const amount = (toShare * p.invested) / putIn; // bigint division rounds down
        if (amount > 0n) extras.push({ memberId, amount, reason: "refund" });
        shared += amount;
      }
    }
    creatorBack = leftover - shared;
  }

  const transfers: Transfer[] = [];
  for (const w of winners) if (w.amount > 0n) transfers.push({ memberId: w.memberId, amount: w.amount, reason: "payout" });
  transfers.push(...extras);
  transfers.push({ memberId: book.creatorId, amount: creatorBack, reason: "seed_return" });
  const bonus = creatorBonus(coins - book.seed);
  if (bonus > 0n) transfers.push({ memberId: book.creatorId, amount: bonus, reason: "creator_bonus" });
  return transfers;
}

/**
 * Unwinds a cancelled market: everyone ends where they started.
 *
 * - A player still down gets back what they put in.
 * - A player who already sold at a profit gives that profit back, but only
 *   from what they have: never below a zero balance (decided 2026-11-10).
 * - The creator gets their seed back, minus any profit that could not be
 *   taken back. If even the whole seed can't cover it, the creator gets 0
 *   and the other refunds shrink in proportion. No coins are ever created.
 *
 * `balances` holds each player's current balance; a missing player counts as 0.
 */
export function cancelRefunds(book: MarketBook, balances: ReadonlyMap<string, Coins>): Transfer[] {
  checkBook(book);
  const debits: Transfer[] = [];
  const credits: Array<{ memberId: string; amount: Coins }> = [];
  let collected = 0n;
  let owedToCreditors = 0n;

  for (const [memberId, p] of book.positions) {
    if (p.invested > 0n) {
      credits.push({ memberId, amount: p.invested });
      owedToCreditors += p.invested;
    } else if (p.invested < 0n) {
      const balance = balances.get(memberId) ?? 0n;
      const take = min(-p.invested, max(balance, 0n));
      if (take > 0n) {
        debits.push({ memberId, amount: -take, reason: "refund" });
        collected += take;
      }
    }
  }

  const available = coinsIn(book) + collected;
  const transfers: Transfer[] = [...debits];

  if (available >= owedToCreditors) {
    for (const c of credits) transfers.push({ ...c, reason: "refund" });
    transfers.push({ memberId: book.creatorId, amount: available - owedToCreditors, reason: "seed_return" });
  } else {
    let paid = 0n;
    for (const c of credits) {
      const amount = (c.amount * available) / owedToCreditors; // bigint division rounds down
      transfers.push({ memberId: c.memberId, amount, reason: "refund" });
      paid += amount;
    }
    transfers.push({ memberId: book.creatorId, amount: available - paid, reason: "seed_return" });
  }
  return transfers;
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);
