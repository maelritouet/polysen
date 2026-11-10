import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { headers } from "next/headers";
import Link from "next/link";
import type { LedgerReason } from "@/core/ledger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { requireMember } from "@/server/session";
import { getBalance, getHistory } from "@/server/wallet";
import { rotateInviteAction } from "../actions";
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
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Accueil
      </Link>
      <Card>
        <CardHeader>
          <CardDescription>Ton solde</CardDescription>
          <CardTitle className="text-4xl tabular-nums">{formatCoinsFr(balance)}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ton lien d&apos;invitation</CardTitle>
          <CardDescription>
            Toute personne qui s&apos;inscrit avec ce lien rejoint le jeu, et on saura que c&apos;est toi qui l&apos;as
            invitée.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CopyLink url={inviteUrl} />
          <form action={rotateInviteAction}>
            <Button type="submit" variant="ghost" className="w-full">
              Lien diffusé trop largement ? En générer un nouveau
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {history.map((row) => (
              <li key={row.id.toString()} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {REASON_LABELS[row.reason]}
                  <span className="block text-xs text-muted-foreground">{DATE.format(row.createdAt)}</span>
                </span>
                <span className={`tabular-nums ${row.amount < 0n ? "text-destructive" : ""}`}>
                  {formatCoinsFr(row.amount, { sign: true })}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
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
