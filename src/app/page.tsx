import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { requireMember } from "@/server/session";
import { getBalance, hasClaimedToday } from "@/server/wallet";
import { listVisibleMarkets } from "@/server/markets";
import { formatParis } from "@/lib/paris-time";
import { buttonVariants } from "@/components/ui/button";
import { signOut } from "./connexion/actions";
import { DropButton } from "./drop-button";

async function HomePageContent() {
  const me = await requireMember();
  const [balance, claimed, markets] = await Promise.all([
    getBalance(db, me.id),
    hasClaimedToday(db, me.id),
    listVisibleMarkets(db, me.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Salut {me.firstName} 👋</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
            Déconnexion
          </button>
        </form>
      </header>
      <Card>
        <CardHeader>
          <CardDescription>Ton solde</CardDescription>
          <CardTitle className="text-4xl tabular-nums">{formatCoinsFr(balance)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DropButton claimed={claimed} />
          <Link href="/portefeuille" className="text-sm underline underline-offset-4">
            Historique et lien d&apos;invitation
          </Link>
        </CardContent>
      </Card>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Marchés</h2>
          <Link href="/marches/nouveau" className={buttonVariants({ size: "sm" })}>
            Créer un marché
          </Link>
        </div>
        {markets.length === 0 && <p className="text-sm text-muted-foreground">Aucun marché ouvert. Lance le premier !</p>}
        {markets.map((m) => (
          <Link key={m.id} href={`/marches/${m.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardDescription>
                  {m.status === "pending_approval" ? "En attente d'accord · " : ""}Ferme {formatParis(m.closeAt)}
                </CardDescription>
                <CardTitle className="flex items-start justify-between gap-3 text-base leading-snug">
                  <span>{m.question}</span>
                  <span className="shrink-0 tabular-nums">{m.percent} %</span>
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
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
