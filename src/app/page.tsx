import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Sparkline } from "@/components/market/sparkline";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/db";
import { closesIn } from "@/lib/format-time";
import { getPriceHistories } from "@/server/history";
import { listVisibleMarkets } from "@/server/markets";
import { requireMember } from "@/server/session";
import { getBalance, hasClaimedToday } from "@/server/wallet";
import { signOut } from "./connexion/actions";
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
    <div className="flex flex-col gap-6">
      <AppHeader balance={balance} />

      {!claimed && <DropButton claimed={claimed} />}

      <section>
        <h1 className="text-2xl font-bold">Marchés ouverts</h1>
        {markets.length === 0 ? (
          <p className="mt-2 text-dim">Aucun marché pour l&apos;instant. Pose la première question au groupe.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {markets.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/marches/${m.id}`}
                  className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug font-semibold">{m.question}</p>
                    <p className="mt-1 text-sm text-dim">
                      {m.status === "pending_approval" ? "En attente d'accord" : closesIn(m.closeAt, now)}
                    </p>
                  </div>
                  <Sparkline points={histories.get(m.id) ?? []} now={now} />
                  <p className="w-14 shrink-0 text-right text-xl font-extrabold text-yes tabular-nums">{m.percent} %</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={signOut} className="mt-4">
        <button type="submit" className="text-sm text-dim underline underline-offset-4">
          Se déconnecter
        </button>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-night/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/marches/nouveau"
            className="flex h-13 items-center justify-center rounded-xl bg-ink text-base font-extrabold text-night focus-visible:ring-2 focus-visible:ring-yes focus-visible:outline-none"
          >
            Poser une question au groupe
          </Link>
        </div>
      </div>
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
