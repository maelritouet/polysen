import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileTabBar } from "@/components/nav-links";
import { formatCoinsFr } from "@/lib/format";
import { Sparkline } from "@/components/market/sparkline";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/db";
import { closesIn } from "@/lib/format-time";
import { getPriceHistories } from "@/server/history";
import { listVisibleMarkets } from "@/server/markets";
import { requireMember } from "@/server/session";
import { getBalance, hasClaimedToday } from "@/server/wallet";
import { DropButton } from "./drop-button";

async function HomePageContent() {
  const me = await requireMember();
  const [balance, claimed, markets] = await Promise.all([
    getBalance(db, me.id),
    hasClaimedToday(db, me.id),
    listVisibleMarkets(db, me.id),
  ]);
  const histories = await getPriceHistories(db, markets.map((m) => m.id));
  const now = markets[0]?.asOf.getTime() ?? 0;

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <h1 className="text-2xl font-bold lg:text-3xl">Marchés ouverts</h1>
          {markets.length === 0 ? (
            <p className="mt-2 text-dim">Aucun marché pour l&apos;instant. Pose la première question au groupe.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {markets.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/marches/${m.id}`}
                    className="flex h-full flex-col justify-between gap-4 rounded-xl border border-line bg-panel/40 p-4 transition-colors hover:border-dim/50 hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <p className="leading-snug font-semibold">{m.question}</p>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-extrabold text-yes tabular-nums">{m.percent} %</p>
                        <p className="text-sm text-dim">
                          {m.status === "pending_approval" ? "En attente d'accord" : closesIn(m.closeAt, now)}
                        </p>
                      </div>
                      <Sparkline points={histories.get(m.id) ?? []} now={now} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:order-none order-first">
          <div className={`rounded-xl border-line lg:border lg:p-4 ${claimed ? "hidden lg:block" : ""}`}>
            <div className="hidden lg:block">
              <p className="text-sm text-dim">Ton solde</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">
                {formatCoinsFr(balance)} <span className="text-base font-normal text-dim">pièces</span>
              </p>
            </div>
            {!claimed && (
              <div className="lg:mt-4">
                <DropButton claimed={claimed} />
              </div>
            )}
          </div>
        </aside>
      </div>
      <MobileTabBar />
    </div>
  );
}

/** Instant shell; the per-member content streams in (Cache Components). */
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
