import { Suspense } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { toParisLocal } from "@/lib/paris-time";
import { listMembers } from "@/server/members";
import { closeDateDefaults, CONTENT_RULES } from "@/server/markets";
import { requireMember } from "@/server/session";
import { CreateMarketForm } from "./create-form";

async function NewMarketContent() {
  const me = await requireMember();
  const members = (await listMembers(db)).filter((m) => m.id !== me.id);
  const close = closeDateDefaults();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Retour
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau marché</CardTitle>
          <CardDescription>Une question oui/non. Lancer un marché coûte 100 pièces.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateMarketForm
            members={members}
            rules={CONTENT_RULES}
            defaultClose={toParisLocal(close.suggested)}
            minClose={toParisLocal(close.min)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewMarketPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewMarketContent />
    </Suspense>
  );
}
