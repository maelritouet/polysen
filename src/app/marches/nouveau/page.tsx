import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/db";
import { toParisLocal } from "@/lib/paris-time";
import { listMembers } from "@/server/members";
import { closeDateDefaults, CONTENT_RULES } from "@/server/markets";
import { requireMember } from "@/server/session";
import { getBalance } from "@/server/wallet";
import { CreateMarketForm } from "./create-form";

async function NewMarketContent() {
  const me = await requireMember();
  const [all, balance] = await Promise.all([listMembers(db), getBalance(db, me.id)]);
  const members = all.filter((m) => m.id !== me.id);
  const close = closeDateDefaults();
  return (
    <div>
      <AppHeader balance={balance} />
      <h1 className="text-2xl font-bold">Poser une question</h1>
      <p className="mt-1 text-dim">Une question à laquelle on répond par oui ou non. Lancer le marché coûte 100 pièces.</p>
      <div className="mt-6">
        <CreateMarketForm
          members={members}
          rules={CONTENT_RULES}
          defaultClose={toParisLocal(close.suggested)}
          minClose={toParisLocal(close.min)}
        />
      </div>
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
