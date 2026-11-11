import Link from "next/link";
import { formatWholeCoinsFr } from "@/lib/format";
import { closesIn } from "@/lib/format-time";
import type { MarketStats, PricePoint } from "@/server/history";
import type { MarketSummary } from "@/server/markets";
import { Sparkline } from "./sparkline";

interface Props {
  market: MarketSummary;
  stats: MarketStats;
  points: PricePoint[];
  now: number;
}

/** A market in the home grid: question, odds, trend, activity and time left. */
export function MarketCard({ market: m, stats, points, now }: Props) {
  return (
    <Link
      href={`/marches/${m.id}`}
      className="flex h-full flex-col justify-between gap-4 rounded-xl border border-line bg-panel/40 p-4 transition-colors hover:border-dim/50 hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <p className="leading-snug font-semibold">{m.question}</p>
      <div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-extrabold text-yes tabular-nums">
            {m.percent} %<span className="ml-1.5 text-sm font-medium text-dim">oui</span>
          </p>
          <Sparkline points={points} now={now} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
          <span>{m.status === "pending_approval" ? "En attente d'accord" : closesIn(m.closeAt, now)}</span>
          {stats.players > 0 ? (
            <>
              <span>
                {stats.players} joueur{stats.players > 1 ? "s" : ""}
              </span>
              <span>{formatWholeCoinsFr(stats.volume)} pièces échangées</span>
            </>
          ) : (
            <span>Aucun pari encore</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** A compact card for the "closing soon" strip. */
export function ClosingCard({ market: m, now }: { market: MarketSummary; now: number }) {
  return (
    <Link
      href={`/marches/${m.id}`}
      className="flex w-64 shrink-0 snap-start flex-col justify-between gap-3 rounded-xl border border-line p-4 transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <p className="line-clamp-2 text-sm leading-snug font-semibold">{m.question}</p>
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-extrabold text-yes tabular-nums">{m.percent} %</span>
        <span className="text-sm font-semibold text-no">{closesIn(m.closeAt, now).replace("Ferme dans ", "")}</span>
      </div>
    </Link>
  );
}
