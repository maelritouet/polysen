import { formatCoins, type Coins } from "@/core/money";

const NNBSP = " "; // narrow no-break space
const MINUS = "−"; // typographic minus

/**
 * Coins in French notation: "1 234,56". Pure string work on the exact
 * amount, so no floating-point rounding can ever creep into what's shown.
 */
export function formatCoinsFr(amount: Coins, options: { sign?: boolean } = {}): string {
  const [whole, fraction] = formatCoins(amount < 0n ? -amount : amount).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const sign = amount < 0n ? MINUS : options.sign && amount > 0n ? "+" : "";
  return `${sign}${grouped},${fraction}`;
}

/** A share count in French notation with 2 decimals, rounded down: "134,72". */
export function formatSharesFr(shares: { toFixed(dp: number, rm?: number): string }): string {
  const [whole, fraction] = shares.toFixed(2, 1 /* ROUND_DOWN */).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)},${fraction}`;
}

/** Whole coins, rounded down, grouped: "1 234". For volumes, where hundredths are noise. */
export function formatWholeCoinsFr(amount: Coins): string {
  return (amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}
