import Decimal from "decimal.js";
import { coinsToDecimal, D, decimalToCoinsDown, type Coins, type Dec } from "./money";

/**
 * Constant-product market maker (Manifold's "CPMM" with p = 0.5).
 *
 * The pool holds YES shares and NO shares. A winning share pays 1 coin.
 * Every coin that enters the market mints one YES share and one NO share, so
 * for each side: shares held by players + shares in the pool = coins in the market.
 * Trades keep the product yes × no constant, which sets the price:
 *
 *   P(YES) = no / (yes + no)
 *
 * All rounding goes in the pool's favour (buyers get shares rounded down,
 * sellers get coins rounded down), so the pool can never be drained by rounding.
 */

export type Side = "YES" | "NO";

export interface Pool {
  /** YES shares held by the pool. */
  yes: Dec;
  /** NO shares held by the pool. */
  no: Dec;
}

/** Shares are kept to 12 decimals: fine enough that rounding never shows in coins. */
export const SHARE_DECIMALS = 12;

/**
 * Tolerance when converting a sale's exact value to hundredths. Rounding a
 * buyer's shares down to 12 decimals makes "sell straight back" come out a
 * billionth of a coin short; without this, that would become a whole 0.01 lost.
 * One millionth of a coin is far above that error and far below a hundredth.
 */
const SALE_EPSILON = new D("0.000001");

/** The pool may never hold less than this many shares on either side. */
const MIN_POOL_SHARES = new D("0.0001");

export function newPool(seed: Coins): Pool {
  if (seed <= 0n) throw new Error("The seed must be positive");
  const s = coinsToDecimal(seed);
  return { yes: s, no: s };
}

/** Probability of YES, between 0 and 1 (exclusive). */
export function probability(pool: Pool): Dec {
  return pool.no.div(pool.yes.plus(pool.no));
}

/** Probability shown on screen: a whole percentage, clamped to 1..99. */
export function displayPercent(pool: Pool): number {
  const pct = probability(pool).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  return Math.min(99, Math.max(1, pct));
}

export interface BuyQuote {
  /** Shares the buyer receives. */
  shares: Dec;
  pool: Pool;
  probBefore: Dec;
  probAfter: Dec;
}

export function quoteBuy(pool: Pool, side: Side, amount: Coins): BuyQuote {
  if (amount <= 0n) throw new Error("A bet must be positive");
  const m = coinsToDecimal(amount);
  const k = pool.yes.mul(pool.no);

  // Orient the pool so "same" is the side being bought.
  const same = side === "YES" ? pool.yes : pool.no;
  const other = side === "YES" ? pool.no : pool.yes;

  // Mint m pairs: both sides grow by m. Then give the buyer enough "same"
  // shares to bring the product back to k.
  const otherAfter = other.plus(m);
  const sameTarget = k.div(otherAfter);
  const shares = same.plus(m).minus(sameTarget).toDecimalPlaces(SHARE_DECIMALS, Decimal.ROUND_DOWN);
  const sameAfter = same.plus(m).minus(shares);

  if (sameAfter.lt(MIN_POOL_SHARES)) throw new Error("This bet is too large for the pool");

  const after: Pool =
    side === "YES" ? { yes: sameAfter, no: otherAfter } : { yes: otherAfter, no: sameAfter };
  return { shares, pool: after, probBefore: probability(pool), probAfter: probability(after) };
}

export interface SellQuote {
  /** Coins the seller receives, in hundredths. */
  proceeds: Coins;
  pool: Pool;
  probBefore: Dec;
  probAfter: Dec;
}

export function quoteSell(pool: Pool, side: Side, shares: Dec): SellQuote {
  if (!shares.gt(0)) throw new Error("A sale must be positive");
  if (shares.decimalPlaces() > SHARE_DECIMALS) throw new Error("Too many decimals in shares");
  const k = pool.yes.mul(pool.no);

  // The seller gives `shares` to the pool; the pool then burns r pairs
  // (r YES + r NO) and pays r coins, keeping the product at k:
  //   (same + shares − r) × (other − r) = k
  // The smaller root of that quadratic is the sale value.
  const same = (side === "YES" ? pool.yes : pool.no).plus(shares);
  const other = side === "YES" ? pool.no : pool.yes;
  const disc = same.minus(other).pow(2).plus(k.mul(4));
  const exact = same.plus(other).minus(disc.sqrt()).div(2);

  const proceeds = decimalToCoinsDown(exact.plus(SALE_EPSILON));
  if (proceeds <= 0n) throw new Error("This sale is too small to be worth a hundredth of a coin");

  const r = coinsToDecimal(proceeds);
  const sameAfter = same.minus(r);
  const otherAfter = other.minus(r);
  if (sameAfter.lt(MIN_POOL_SHARES) || otherAfter.lt(MIN_POOL_SHARES)) {
    throw new Error("This sale is too large for the pool");
  }

  const after: Pool =
    side === "YES" ? { yes: sameAfter, no: otherAfter } : { yes: otherAfter, no: sameAfter };
  return { proceeds, pool: after, probBefore: probability(pool), probAfter: probability(after) };
}
