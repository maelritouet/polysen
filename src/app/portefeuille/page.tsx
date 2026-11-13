import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileTabBar } from "@/components/nav-links";
import { Gain, POSITION_GRID, PositionRow } from "@/components/portfolio";
import { PageSkeleton } from "@/components/page-skeleton";
import type { LedgerReason } from "@/core/ledger";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { getPortfolio } from "@/server/portfolio";
import { requireMember } from "@/server/session";
import { getBalance, getHistory } from "@/server/wallet";
import { rotateInviteAction } from "../actions";
import { signOut } from "../connexion/actions";
import { CopyLink } from "./copy-link";

const REASON_LABELS: Record<LedgerReason, string> = {
  grant: "Bienvenue",
  drop: "Récompense du jour",
  bet: "Pari",
  sale: "Vente",
  payout: "Gain",
  refund: "Remboursement",
  creator_bonus: "Bonus de créateur",
  seed: "Lancement d'un marché",
  seed_return: "Retour de mise de départ",
};

const DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

async function PortefeuillePageContent() {
  const me = await requireMember();
  const [balance, history, portfolio] = await Promise.all([getBalance(db, me.id), getHistory(db, me.id), getPortfolio(db, me.id)]);
  const now = portfolio.asOf.getTime();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const inviteUrl = `${origin}/invitation/${me.inviteCode}`;

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-sm text-dim">Ton solde</dt>
              <dd className="mt-1 text-4xl font-extrabold tabular-nums">{formatCoinsFr(balance)}</dd>
            </div>
            <div>
              <dt className="text-sm text-dim">En jeu</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums lg:mt-3">{formatCoinsFr(portfolio.value)}</dd>
            </div>
            <div>
              <dt className="text-sm text-dim">Si tu vendais tout</dt>
              <dd className="mt-1 text-2xl font-bold lg:mt-3">
                <Gain amount={portfolio.value - portfolio.cost} />
              </dd>
            </div>
          </dl>

          <h2 className="mt-10 text-lg font-bold">Positions ouvertes</h2>
          {portfolio.open.length === 0 ? (
            <p className="mt-2 text-sm text-dim">
              Aucun pari en cours.{" "}
              <Link href="/" className="font-semibold text-ink underline underline-offset-4">
                Voir les marchés
              </Link>
            </p>
          ) : (
            <ul className="mt-2">
              <li aria-hidden className={`${POSITION_GRID} hidden pb-2 text-xs text-dim sm:grid`}>
                <span>Marché</span>
                <span className="text-right">Parts</span>
                <span className="text-right" title="Pièces misées moins pièces récupérées en revendant">
                  Coût
                </span>
                <span className="text-right" title="Ce que « Tout vendre » rapporterait maintenant">
                  Valeur
                </span>
                <span className="text-right">Gain</span>
              </li>
              {portfolio.open.map((o) => (
                <PositionRow key={`${o.marketId}-${o.side}`} position={o} now={now} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-dim">
            La valeur, c&apos;est ce que « Tout vendre » te rapporterait maintenant. Si ton camp gagne, chaque part paie au moins 1 pièce.
          </p>

          {portfolio.closed.length > 0 && (
            <>
              <h2 className="mt-10 text-lg font-bold">Paris terminés</h2>
              <ul className="mt-2 divide-y divide-line">
                {portfolio.closed.map((c) => (
                  <li key={c.marketId} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="min-w-0">
                      <Link href={`/marches/${c.marketId}`} className="line-clamp-1 font-semibold underline-offset-4 hover:underline">
                        {c.question}
                      </Link>
                      <span className="block text-xs text-dim">
                        {c.status === "cancelled" ? "Annulé, mises rendues" : `Résolu : ${c.outcome === "NO" ? "non" : "oui"}`} · misé {formatCoinsFr(c.spent)} · récupéré{" "}
                        {formatCoinsFr(c.received)}
                      </span>
                    </span>
                    <Gain amount={c.net} className="shrink-0 font-semibold" />
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-10 text-lg font-bold">Historique</h2>
          <ul className="mt-2 divide-y divide-line">
            {history.map((row) => (
              <li key={row.id.toString()} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>
                  {row.marketId ? (
                    <Link href={`/marches/${row.marketId}`} className="underline-offset-4 hover:underline">
                      {REASON_LABELS[row.reason]}
                    </Link>
                  ) : (
                    REASON_LABELS[row.reason]
                  )}
                  <span className="block text-xs text-dim">{DATE.format(row.createdAt)}</span>
                </span>
                <span className={`font-semibold tabular-nums ${row.amount < 0n ? "text-no" : "text-yes"}`}>
                  {formatCoinsFr(row.amount, { sign: true })}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-xl border border-line p-4">
            <h2 className="font-bold">Ton lien d&apos;invitation</h2>
            <p className="mt-1 text-sm text-dim">
              Toute personne qui s&apos;inscrit avec ce lien rejoint le jeu, et on saura que c&apos;est toi qui l&apos;as invitée.
            </p>
            <div className="mt-4">
              <CopyLink url={inviteUrl} />
            </div>
            <form action={rotateInviteAction} className="mt-2">
              <button type="submit" className="text-sm text-dim underline underline-offset-4">
                Lien diffusé trop largement ? En générer un nouveau
              </button>
            </form>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/journal" className="font-semibold text-dim hover:text-ink">
              Journal des décisions de l&apos;admin →
            </Link>
            {me.role === "admin" && (
              <Link href="/admin" className="font-semibold text-gold hover:text-ink">
                Espace admin →
              </Link>
            )}
          </nav>
          <form action={signOut}>
            <button type="submit" className="text-sm text-dim underline underline-offset-4">
              Se déconnecter
            </button>
          </form>
        </aside>
      </div>
      <MobileTabBar />
    </div>
  );
}

/** Instant shell; the per-member content streams in (Cache Components). */
export default function PortefeuillePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PortefeuillePageContent />
    </Suspense>
  );
}
