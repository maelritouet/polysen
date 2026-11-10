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
