import Link from "next/link";
import type { Coins } from "@/core/money";
import { formatCoinsFr, formatSharesFr } from "@/lib/format";
import { closesIn } from "@/lib/format-time";
import type { OpenPosition, Portfolio } from "@/server/portfolio";

/** A signed gain or loss, mint when up, coral when down. */
export function Gain({ amount, className = "" }: { amount: Coins; className?: string }) {
  const tone = amount > 0n ? "text-yes" : amount < 0n ? "text-no" : "text-dim";
  return <span className={`tabular-nums ${tone} ${className}`}>{formatCoinsFr(amount, { sign: true })}</span>;
}

export function SideChip({ side }: { side: "YES" | "NO" }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${side === "YES" ? "bg-yes/15 text-yes" : "bg-no/15 text-no"}`}
    >
      {side === "YES" ? "OUI" : "NON"}
    </span>
  );
}

/** Dashboard card: balance, what the open bets are worth, and the biggest ones. */
export function PortfolioSummary({ balance, portfolio: p, now }: { balance: Coins; portfolio: Portfolio; now: number }) {
  const top = [...p.open].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0)).slice(0, 4);
  return (
    <div>
      <p className="text-sm text-dim">Ton solde</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">
        {formatCoinsFr(balance)} <span className="text-base font-normal text-dim">pièces</span>
      </p>
      {p.open.length > 0 && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-dim">En jeu</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums">{formatCoinsFr(p.value)}</dd>
            </div>
            <div>
              <dt className="text-dim">Si tu vendais tout</dt>
              <dd className="mt-0.5 text-lg font-bold">
                <Gain amount={p.value - p.cost} />
              </dd>
            </div>
          </dl>
          <ul className="mt-3 divide-y divide-line">
            {top.map((o) => (
              <li key={`${o.marketId}-${o.side}`}>
                <Link
                  href={`/marches/${o.marketId}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-sm">{o.question}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-dim">
                      <SideChip side={o.side} /> {closesIn(o.closeAt, now)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-semibold tabular-nums">{formatCoinsFr(o.value)}</span>
                    <Gain amount={o.value - o.cost} className="text-xs" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/portefeuille" className="mt-3 inline-block text-sm font-semibold text-dim hover:text-ink">
        {p.open.length > 0 ? `Tout ton portefeuille (${p.open.length} position${p.open.length > 1 ? "s" : ""}) →` : "Ton portefeuille →"}
      </Link>
    </div>
  );
}

/** Columns of the full positions list: market, then four figures from sm up. */
export const POSITION_GRID = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 sm:grid-cols-[minmax(0,1fr)_repeat(4,5.5rem)]";

/** One open position in the full list. On phones the figures go under the question. */
export function PositionRow({ position: o, now }: { position: OpenPosition; now: number }) {
  return (
    <li className={`${POSITION_GRID} items-center border-t border-line py-3 text-sm`}>
      <div className="min-w-0">
        <Link href={`/marches/${o.marketId}`} className="line-clamp-2 font-semibold underline-offset-4 hover:underline">
          {o.question}
        </Link>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
          <SideChip side={o.side} /> {o.percent} % oui · {closesIn(o.closeAt, now)}
          <span className="w-full tabular-nums sm:hidden">
            {formatSharesFr(o.shares)} parts · coût {formatCoinsFr(o.cost)}
          </span>
        </span>
      </div>
      <span className="hidden text-right tabular-nums sm:block">{formatSharesFr(o.shares)}</span>
      <span className="hidden text-right tabular-nums sm:block">{formatCoinsFr(o.cost)}</span>
      <span className="text-right sm:contents">
        <span className="block text-right font-semibold tabular-nums">{formatCoinsFr(o.value)}</span>
        <Gain amount={o.value - o.cost} className="block text-right text-xs font-semibold sm:text-sm" />
      </span>
    </li>
  );
}
