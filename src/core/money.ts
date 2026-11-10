import Decimal from "decimal.js";

/**
 * Coin amounts are integers counted in hundredths of a coin (1 coin = 100n).
 * Using bigint means adding and subtracting amounts is always exact:
 * a market can net to zero "to the hundredth" only if amounts never drift.
 */
export type Coins = bigint;

/**
 * High-precision decimal used for the market maker's maths (shares, prices).
 * 60 significant digits is far more than any pool here needs, so additions of
 * the values we store are exact and only our explicit roundings lose anything.
 */
export const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });
export type Dec = InstanceType<typeof D>;

const HUNDRED = 100n;
const PLAIN_AMOUNT = /^\d+(\.\d{1,2})?$/;

/** Reads a user-typed amount ("37.42") as hundredths. Refuses anything ambiguous. */
export function parseCoins(text: string): Coins {
  if (!PLAIN_AMOUNT.test(text)) {
    throw new Error(`Invalid coin amount: "${text}"`);
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
}

/** Shows hundredths as a coin amount with exactly two decimals ("37.42", "-1.05"). */
export function formatCoins(amount: Coins): string {
  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;
  const whole = abs / HUNDRED;
  const fraction = (abs % HUNDRED).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/** Exact decimal value of an amount in hundredths. */
export function coinsToDecimal(amount: Coins): Dec {
  return new D(amount.toString()).div(100);
}

/** Rounds down to the hundredth: used for anything paid to a player. */
export function decimalToCoinsDown(value: Dec): Coins {
  if (value.isNegative() && !value.isZero()) {
    throw new Error(`Cannot pay a negative amount: ${value.toString()}`);
  }
  return BigInt(value.mul(100).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toFixed(0));
}

/** Rounds up to the hundredth: used for anything charged by the pool. */
export function decimalToCoinsUp(value: Dec): Coins {
  return BigInt(value.mul(100).toDecimalPlaces(0, Decimal.ROUND_CEIL).toFixed(0));
}
