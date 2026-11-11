import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileTabBar } from "@/components/nav-links";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/db";
import { formatParis } from "@/lib/paris-time";
import { getAdminLog, type LogRow } from "@/server/admin";
import { requireMember } from "@/server/session";
import { getBalance } from "@/server/wallet";

const WHAT: Record<LogRow["kind"], string> = {
  resolve: "a tranché",
  cancel: "a annulé et remboursé",
  restore_market: "a rétabli après signalement",
  delete_comment: "a supprimé un message dans",
  dismiss_report: "a classé un signalement sur",
  suspend: "a suspendu",
  unsuspend: "a réactivé",
  revoke_create: "a retiré le droit de créer des marchés à",
  restore_create: "a rendu le droit de créer des marchés à",
};

async function JournalContent() {
  const me = await requireMember();
  const [balance, rows] = await Promise.all([getBalance(db, me.id), getAdminLog(db)]);
  return (
    <div>
      <AppHeader balance={balance} />
      <h1 className="text-2xl font-bold lg:text-3xl">Journal de l&apos;admin</h1>
      <p className="mt-1 max-w-prose text-sm text-dim">
        Chaque décision de l&apos;admin est notée ici, pour que tout le monde puisse vérifier qu&apos;elle est juste.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-dim">Aucune décision pour l&apos;instant.</p>
      ) : (
        <ul className="mt-6 max-w-3xl divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id.toString()} className="py-3 text-sm">
              <p>
                <span className="font-semibold">@{r.admin}</span> {WHAT[r.kind]}{" "}
                {r.member && <span className="font-semibold">@{r.member}</span>}
                {r.marketId && (
                  <Link href={`/marches/${r.marketId}`} className="font-semibold underline-offset-4 hover:underline">
                    « {r.question} »
                  </Link>
                )}
              </p>
              {r.note && <p className="mt-0.5 text-dim">{r.note}</p>}
              <p className="mt-0.5 text-xs text-dim">{formatParis(r.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <MobileTabBar />
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JournalContent />
    </Suspense>
  );
}
