import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { requireMember } from "@/server/session";
import { getBalance, hasClaimedToday } from "@/server/wallet";
import { signOut } from "./connexion/actions";
import { DropButton } from "./drop-button";

async function HomePageContent() {
  const me = await requireMember();
  const [balance, claimed] = await Promise.all([getBalance(db, me.id), hasClaimedToday(db, me.id)]);

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
      <p className="text-sm text-muted-foreground">Les marchés arrivent bientôt.</p>
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
