import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileTabBar } from "@/components/nav-links";
import { PageSkeleton } from "@/components/page-skeleton";
import { db } from "@/db";
import { formatParis } from "@/lib/paris-time";
import { getAdminQueue } from "@/server/admin";
import { requireAdmin } from "@/server/session";
import { getBalance } from "@/server/wallet";
import {
  deleteCommentAdminAction,
  dismissReportAction,
  resolveAction,
  restoreMarketAction,
  setCanCreateAction,
  setSuspendedAction,
} from "./actions";
import { ActionButton, RulingForm } from "./controls";

const OUTCOME = { YES: "Oui", NO: "Non", CANCEL: "Annuler" } as const;
const card = "rounded-xl border border-line p-4";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-dim">{children}</p>;
}

async function AdminContent() {
  const me = await requireAdmin();
  const [balance, q] = await Promise.all([getBalance(db, me.id), getAdminQueue(db)]);
  const waiting = q.disputes.length + q.overdue.length + q.reports.length;

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-dim">
            {waiting === 0 ? "Rien en attente." : `${waiting} chose${waiting > 1 ? "s" : ""} en attente. Objectif : tout régler sous 24 h.`}
          </p>
        </div>
        <Link href="/journal" className="text-sm font-semibold text-dim hover:text-ink">
          Journal public →
        </Link>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold">Contestations</h2>
          {q.disputes.length === 0 ? (
            <Empty>Aucun résultat contesté.</Empty>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {q.disputes.map((d) => (
                <li key={d.resolutionId.toString()} className={card}>
                  <Link href={`/marches/${d.marketId}`} className="font-semibold underline-offset-4 hover:underline">
                    {d.question}
                  </Link>
                  <p className="mt-2 text-sm">
                    <span className="text-dim">Proposé :</span> <span className="font-bold">{OUTCOME[d.proposed]}</span>
                  </p>
                  <p className="mt-1 text-sm break-words text-dim">Preuve : {d.proof}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {d.reasons.map((r, i) => (
                      <li key={i}>
                        <span className="font-semibold">@{r.nickname}</span> conteste : {r.reason}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <RulingForm rule={resolveAction.bind(null, d.marketId)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold">Sans résultat depuis 48 h</h2>
          {q.overdue.length === 0 ? (
            <Empty>Tous les marchés fermés ont un résultat proposé.</Empty>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {q.overdue.map((o) => (
                <li key={o.marketId} className={card}>
                  <Link href={`/marches/${o.marketId}`} className="font-semibold underline-offset-4 hover:underline">
                    {o.question}
                  </Link>
                  <p className="mt-1 text-sm text-dim">
                    Créé par @{o.creator} · fermé le {formatParis(o.closeAt)}
                  </p>
                  <div className="mt-3">
                    <RulingForm rule={resolveAction.bind(null, o.marketId)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold">Signalements</h2>
          {q.reports.length === 0 ? (
            <Empty>Aucun signalement.</Empty>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {q.reports.map((r) => (
                <li key={r.id.toString()} className={card}>
                  <p className="text-xs text-dim">
                    @{r.reporter} · {formatParis(r.createdAt)} · {r.commentId ? "un message" : r.hidden ? "marché masqué" : "marché"}
                  </p>
                  <Link href={`/marches/${r.marketId}`} className="mt-1 block font-semibold underline-offset-4 hover:underline">
                    {r.question}
                  </Link>
                  {r.commentId && <p className="mt-1 rounded-lg bg-panel px-3 py-2 text-sm break-words">« {r.commentBody ?? "message déjà supprimé"} »</p>}
                  <p className="mt-2 text-sm">
                    <span className="text-dim">Raison :</span> {r.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.commentId ? (
                      <>
                        <ActionButton action={deleteCommentAdminAction.bind(null, r.commentId.toString())} label="Supprimer le message" variant="destructive" confirmText="Supprimer ce message ?" />
                        <ActionButton action={dismissReportAction.bind(null, r.id.toString())} label="Ignorer" />
                      </>
                    ) : (
                      <>
                        <ActionButton action={restoreMarketAction.bind(null, r.marketId)} label="Rétablir le marché" />
                        <ActionButton
                          action={resolveAction.bind(null, r.marketId, "CANCEL", `Signalement : ${r.reason}`)}
                          label="Annuler et rembourser"
                          variant="destructive"
                          confirmText="Annuler ce marché et rembourser tout le monde ?"
                        />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold">Membres</h2>
          <ul className="mt-2 divide-y divide-line">
            {q.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">@{m.nickname}</span> <span className="text-dim">{m.firstName}</span>
                  {m.role === "admin" && <span className="ml-2 text-xs font-bold text-gold">ADMIN</span>}
                  {m.suspended && <span className="ml-2 text-xs font-bold text-no">SUSPENDU</span>}
                  {!m.canCreate && <span className="ml-2 text-xs font-bold text-dim">SANS CRÉATION</span>}
                </span>
                {m.id !== me.id && (
                  <span className="flex gap-2">
                    <ActionButton
                      action={setCanCreateAction.bind(null, m.id, !m.canCreate)}
                      label={m.canCreate ? "Retirer la création" : "Rendre la création"}
                    />
                    <ActionButton
                      action={setSuspendedAction.bind(null, m.id, !m.suspended)}
                      label={m.suspended ? "Réactiver" : "Suspendre"}
                      variant={m.suspended ? "outline" : "destructive"}
                      confirmText={m.suspended ? undefined : `Suspendre @${m.nickname} ? Il ou elle ne pourra plus jouer.`}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <MobileTabBar />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}
