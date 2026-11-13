import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { LeaderboardList } from "@/components/leaderboard";
import { MobileTabBar } from "@/components/nav-links";
import { PageSkeleton } from "@/components/page-skeleton";
import { MIN_PLAYERS } from "@/core/leaderboard";
import { db } from "@/db";
import { getLeaderboard } from "@/server/leaderboard";
import { requireMember } from "@/server/session";
import { getBalance } from "@/server/wallet";

const DAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short" });
const DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });

const TABS = [
  { key: "semaine", label: "Semaine" },
  { key: "saison", label: "Saison" },
] as const;

async function ClassementContent({ searchParams }: { searchParams: PageProps<"/classement">["searchParams"] }) {
  const season = (await searchParams).periode === "saison";
  const me = await requireMember();
  const [balance, board] = await Promise.all([getBalance(db, me.id), getLeaderboard(db)]);
  const rows = season ? board.season : board.week;
  const p = season ? board.seasonPeriod : board.weekPeriod;
  const lastDay = new Date(p.end.getTime() - 1);
  const mine = rows.find((r) => r.memberId === me.id);

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-2xl font-bold lg:text-3xl">Classement</h1>
            <nav aria-label="Période" className="flex gap-1">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={t.key === "semaine" ? "/classement" : "/classement?periode=saison"}
                  scroll={false}
                  aria-current={(t.key === "saison") === season ? "page" : undefined}
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-secondary aria-[current=page]:text-ink"
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <p className="mt-1 text-sm text-dim">
            {season
              ? `Saison du ${DATE.format(p.start)} au ${DATE.format(lastDay)}`
              : `Semaine du ${DAY.format(p.start)} au ${DAY.format(lastDay)} · remise à zéro lundi à minuit`}
          </p>
          <div className="mt-5">
            <LeaderboardList rows={rows} meId={me.id} />
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {mine && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-sm text-dim">{season ? "Ta saison" : "Ta semaine"}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">
                {mine.rank}
                <sup className="text-base">{mine.rank === 1 ? "er" : "e"}</sup>
                <span className="ml-2 text-base font-normal text-dim">sur {rows.length}</span>
              </p>
            </div>
          )}
          <div className="rounded-xl border border-line p-4 text-sm text-dim">
            <h2 className="font-bold text-ink">Ce qui compte</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>Les gains réalisés : quand tu revends des parts, ou quand un marché se termine.</li>
              <li>Un pari encore ouvert ne compte pas tant que tu ne l&apos;as pas revendu.</li>
              <li>Seulement les marchés où au moins {MIN_PLAYERS} personnes ont parié.</li>
              <li>Ni les récompenses du jour, ni les bonus de créateur, ni la mise de départ.</li>
            </ul>
          </div>
        </aside>
      </div>
      <MobileTabBar />
    </div>
  );
}

/** Instant shell; the per-member content streams in (Cache Components). */
export default function ClassementPage({ searchParams }: PageProps<"/classement">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClassementContent searchParams={searchParams} />
    </Suspense>
  );
}
