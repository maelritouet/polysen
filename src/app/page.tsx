import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileTabBar } from "@/components/nav-links";
import { formatCoinsFr } from "@/lib/format";
import { ClosingCard, MarketCard } from "@/components/market/market-card";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/db";
import { closingSoon, parseSort, sortMarkets, SORTS, type SortKey } from "@/lib/market-sort";
import { getMarketStats, getPriceHistories } from "@/server/history";
import { listVisibleMarkets } from "@/server/markets";
import { requireMember } from "@/server/session";
import { getBalance, hasClaimedToday } from "@/server/wallet";
import { DropButton } from "./drop-button";

async function HomePageContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sort: SortKey = parseSort((await searchParams).tri);
  const me = await requireMember();
  const [balance, claimed, markets] = await Promise.all([
    getBalance(db, me.id),
    hasClaimedToday(db, me.id),
    listVisibleMarkets(db, me.id),
  ]);
  const ids = markets.map((m) => m.id);
  const [histories, stats] = await Promise.all([getPriceHistories(db, ids), getMarketStats(db, ids)]);
  const now = markets[0]?.asOf.getTime() ?? 0;
  const enriched = markets.map((m) => ({ ...m, ...stats.get(m.id)! }));
  const soon = closingSoon(enriched, now);
  const sorted = sortMarkets(enriched, sort);

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-10">
          {soon.length > 0 && (
            <section className="min-w-0">
              <h2 className="text-lg font-bold">Ferment bientôt</h2>
              <ul className="-mx-4 mt-3 scrollbar-thin flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:scroll-px-0 lg:px-0">
                {soon.map((m) => (
                  <li key={m.id} className="flex">
                    <ClosingCard market={m} now={now} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-2xl font-bold lg:text-3xl">Marchés</h1>
              <nav aria-label="Trier les marchés" className="flex gap-1">
                {SORTS.map((s) => (
                  <Link
                    key={s.key}
                    href={s.key === "tendance" ? "/" : `/?tri=${s.key}`}
                    scroll={false}
                    aria-current={sort === s.key ? "page" : undefined}
                    className="rounded-md px-3 py-1.5 text-sm font-semibold text-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-secondary aria-[current=page]:text-ink"
                  >
                    {s.label}
                  </Link>
                ))}
              </nav>
            </div>
            {sorted.length === 0 ? (
              <p className="mt-3 text-dim">Aucun marché pour l&apos;instant. Pose la première question au groupe.</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {sorted.map((m) => (
                  <li key={m.id}>
                    <MarketCard market={m} stats={stats.get(m.id)!} points={histories.get(m.id) ?? []} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

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
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomePageContent searchParams={searchParams} />
    </Suspense>
  );
}
