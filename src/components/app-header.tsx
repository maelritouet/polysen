import Link from "next/link";
import type { Coins } from "@/core/money";
import { formatCoinsFr } from "@/lib/format";
import { NavLinks } from "./nav-links";

/** Top bar on member pages: wordmark, desktop navigation, "ask a question", balance. */
export function AppHeader({ balance }: { balance: Coins }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-6 lg:mb-10 lg:border-b lg:border-line lg:pb-4">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-lg font-extrabold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:text-xl">
          Poly&apos;sen
        </Link>
        <NavLinks />
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/marches/nouveau"
          className="hidden h-9 items-center rounded-lg bg-ink px-4 text-sm font-extrabold text-night focus-visible:ring-2 focus-visible:ring-yes focus-visible:outline-none lg:flex"
        >
          Poser une question
        </Link>
        <Link
          href="/portefeuille"
          className="rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Ton solde : ${formatCoinsFr(balance)} pièces. Voir le portefeuille`}
        >
          {formatCoinsFr(balance)} <span className="font-normal text-dim">pièces</span>
        </Link>
      </div>
    </header>
  );
}
