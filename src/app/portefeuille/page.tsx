import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileTabBar } from "@/components/nav-links";
import { PageSkeleton } from "@/components/page-skeleton";
import type { LedgerReason } from "@/core/ledger";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
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
  const [balance, history] = await Promise.all([getBalance(db, me.id), getHistory(db, me.id)]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const inviteUrl = `${origin}/invitation/${me.inviteCode}`;

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <p className="text-sm text-dim">Ton solde</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums">
            {formatCoinsFr(balance)} <span className="text-lg font-normal text-dim">pièces</span>
          </p>
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
