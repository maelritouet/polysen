import Link from "next/link";
import type { Coins } from "@/core/money";
import { formatCoinsFr } from "@/lib/format";

/** Top bar on member pages: the wordmark home, and the balance to the wallet. */
export function AppHeader({ balance }: { balance: Coins }) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <Link href="/" className="text-lg font-extrabold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        Poly&apos;sen
      </Link>
      <Link
        href="/portefeuille"
        className="rounded-full border border-line bg-panel px-3 py-1 text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Ton solde : ${formatCoinsFr(balance)} pièces. Voir le portefeuille`}
      >
        {formatCoinsFr(balance)} <span className="font-normal text-dim">pièces</span>
      </Link>
    </header>
  );
}
