import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BetPanel } from "@/components/market/bet-panel";
import { BetSheet } from "@/components/market/bet-sheet";
import { PriceChart } from "@/components/market/price-chart";
import { SellButton } from "@/components/market/sell-button";
import { PageSkeleton } from "@/components/page-skeleton";
import { SideChip } from "@/components/portfolio";
import type { Side } from "@/core/amm";
import { D, decimalToCoinsDown } from "@/core/money";
import { db } from "@/db";
import { formatCoinsFr, formatSharesFr } from "@/lib/format";
import { ago, closesIn } from "@/lib/format-time";
import { formatParis } from "@/lib/paris-time";
import { getInsiders, listComments } from "@/server/comments";
import { getActivity, getPriceHistory } from "@/server/history";
import { getResolution } from "@/server/resolution";
import { getMarketDetails } from "@/server/markets";
import { requireMember } from "@/server/session";
import { quoteSellFor } from "@/server/trading";
import { getBalance } from "@/server/wallet";
import { CommentForm, DeleteComment } from "./comments";
import { ReportButton } from "./report-button";
import { DisputeForm, ProposeForm } from "./resolution-forms";
import { TagControls } from "./tag-controls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL: Record<Side, string> = { YES: "Oui", NO: "Non" };

async function MarketContent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const m = await getMarketDetails(db, me.id, id);
  if (!m) notFound();
  const [balance, history, activity, thread, insiders, resolution] = await Promise.all([
    getBalance(db, me.id),
    getPriceHistory(db, id),
    getActivity(db, id),
    listComments(db, me.id, id),
    getInsiders(db, id),
    getResolution(db, id),
  ]);
  const now = m.asOf.getTime();

  const tradable = m.status === "open" && !m.bettingClosed && !m.hiddenAt;
  const myTag = m.tags.find((t) => t.memberId === me.id);
  const held: Record<Side, ReturnType<typeof D>> = { YES: D(m.mine?.yes ?? 0), NO: D(m.mine?.no ?? 0) };
  const sides = (["YES", "NO"] as const).filter((s) => held[s].gt(0));
  const sellValue = new Map<Side, string>();
  for (const s of sides) {
    try {
      sellValue.set(s, formatCoinsFr((await quoteSellFor(db, id, me.id, s, "all")).proceeds));
    } catch {
      sellValue.set(s, "moins de 0,01");
    }
  }

  const closedReason =
    m.status === "pending_approval"
      ? "En attente de l'accord des personnes nommées."
      : m.status === "open"
        ? resolution?.status === "disputed"
          ? "Résultat contesté : l'admin tranche."
          : resolution?.status === "proposed"
            ? "Résultat proposé, en attente des contestations."
            : "Les paris sont fermés. Résultat bientôt."
        : m.status === "cancelled"
          ? "Marché annulé : tout le monde a été remboursé."
          : `Résolu : ${resolution?.outcome === "NO" ? "non" : "oui"}.`;
  const live = resolution && (resolution.status === "proposed" || resolution.status === "disputed") ? resolution : null;
  const hoursLeft = live ? Math.max(1, Math.ceil((live.paysAt.getTime() - now) / 3_600_000)) : 0;
  const OUTCOME = { YES: "Oui", NO: "Non", CANCEL: "Annulation" } as const;

  const trade = {
    marketId: m.id,
    percent: m.percent,
    balanceWhole: Number(balance / 100n),
    holds: { YES: held.YES.gt(0), NO: held.NO.gt(0) },
    tradable,
    closedReason,
  };

  return (
    <div>
      <AppHeader balance={balance} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 text-sm text-dim">
              <span>Lancé par @{m.creator.nickname}</span>
              <span title={formatParis(m.closeAt)}>{m.status === "open" ? closesIn(m.closeAt, now) : closedReason}</span>
              {m.creator.id !== me.id && !m.hiddenAt && (
                <span className="ml-auto">
                  <ReportButton target="market" id={m.id} />
                </span>
              )}
            </div>
            {m.hiddenAt && (
              <p className="mt-3 rounded-lg border border-no/50 bg-no/10 px-3 py-2 text-sm text-no">
                Ce marché a été signalé : il est masqué pour les autres et les paris sont suspendus en attendant l&apos;admin.
              </p>
            )}
            <h1 className="mt-2 text-2xl leading-tight font-bold text-balance lg:text-3xl">{m.question}</h1>
            {insiders.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Initiés qui ont parié">
                {insiders.map((i) => (
                  <li
                    key={i.memberId}
                    title="Cette personne peut en savoir plus que les autres sur ce marché."
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold"
                  >
                    <span aria-hidden>👁</span>
                    {i.memberId === me.id ? "Toi" : `@${i.nickname}`} ({i.role === "creator" ? "créateur" : "nommé·e"}) a parié{" "}
                    {i.sides.map((s) => LABEL[s].toLowerCase()).join(" et ")}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <PriceChart points={history} now={now} end={now} />

          {myTag && (m.status === "open" || m.status === "pending_approval") && (
            <TagControls marketId={m.id} canRespond={m.status === "pending_approval" && myTag.status === "pending"} />
          )}

          {m.status === "open" && m.bettingClosed && (
            <section className={`rounded-xl border p-4 ${live?.status === "disputed" ? "border-no/50" : "border-gold/50"}`}>
              <h2 className="font-bold">Résultat</h2>
              {!live ? (
                m.creator.id === me.id ? (
                  <>
                    <p className="mt-1 text-sm text-dim">
                      Les paris sont fermés. Propose le résultat avec une preuve : il sera payé 24 h plus tard si personne ne le conteste.
                    </p>
                    <ProposeForm marketId={m.id} />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-dim">Les paris sont fermés. @{m.creator.nickname} doit proposer le résultat.</p>
                )
              ) : (
                <div className="mt-2 flex flex-col gap-3 text-sm">
                  <p>
                    <span className="text-dim">Proposé par @{m.creator.nickname} :</span>{" "}
                    <span className={`font-extrabold ${live.outcome === "YES" ? "text-yes" : live.outcome === "NO" ? "text-no" : ""}`}>
                      {OUTCOME[live.outcome]}
                    </span>
                  </p>
                  <p className="break-words whitespace-pre-line text-dim">Preuve : {live.proof}</p>
                  {live.status === "disputed" ? (
                    <p className="font-semibold text-no">
                      Contesté ({live.disputes}). Pas de paiement tant que l&apos;admin n&apos;a pas tranché.
                    </p>
                  ) : (
                    <>
                      <p className="text-dim">
                        Paiement automatique dans {hoursLeft} h ({formatParis(live.paysAt)}), sauf contestation.
                      </p>
                      {m.mine && m.creator.id !== me.id && <DisputeForm resolutionId={live.id.toString()} />}
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {sides.length > 0 && m.status === "open" && (
            <section className="rounded-xl border border-line p-4">
              <h2 className="font-bold">Ta position</h2>
              <ul className="mt-3 space-y-3">
                {sides.map((s) => (
                  <li key={s} className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <p>
                        <span className={`font-bold ${s === "YES" ? "text-yes" : "text-no"}`}>{LABEL[s]}</span>{" "}
                        <span className="tabular-nums">{formatSharesFr(held[s])} parts</span>
                      </p>
                      <p className="text-dim">
                        Si c&apos;est {LABEL[s].toLowerCase()} : au moins {formatCoinsFr(decimalToCoinsDown(held[s]))}. Revente
                        maintenant : {sellValue.get(s)}.
                      </p>
                    </div>
                    {tradable && <SellButton side={s} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="font-bold">Comment on saura</h2>
            <p className="mt-1 text-dim">{m.criteria}</p>
            <p className="mt-3 text-sm text-dim">Fermeture des paris le {formatParis(m.closeAt)}.</p>
            {m.tags.length > 0 && (
              <p className="mt-1 text-sm text-dim">
                Personnes nommées :{" "}
                {m.tags
                  .map((t) => `@${t.nickname}${t.status === "pending" ? " (en attente)" : t.status === "refused" ? " (a refusé)" : ""}`)
                  .join(", ")}
              </p>
            )}
          </section>

          <section>
            <h2 className="font-bold">
              Discussion{thread.length > 0 && <span className="ml-1.5 font-normal text-dim">{thread.length}</span>}
            </h2>
            {(m.status === "open" || m.status === "pending_approval") && (
              <div className="mt-2">
                <CommentForm marketId={m.id} />
              </div>
            )}
            {thread.length === 0 ? (
              <p className="mt-2 text-sm text-dim">Personne n&apos;a encore rien dit.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {thread.map((c) => (
                  <li key={c.id.toString()} className="py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold">@{c.nickname}</span>
                      {c.holding && <SideChip side={c.holding} />}
                      <span className="text-xs text-dim">{ago(c.createdAt, now)}</span>
                      {c.body !== null && (
                        <span className="ml-auto">
                          {c.memberId === me.id ? <DeleteComment id={c.id.toString()} /> : <ReportButton target="comment" id={c.id.toString()} />}
                        </span>
                      )}
                    </p>
                    {c.body === null ? (
                      <p className="mt-1 text-dim italic">Message supprimé.</p>
                    ) : (
                      <p className="mt-1 break-words whitespace-pre-line">{c.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-bold">Activité</h2>
            {activity.length === 0 ? (
              <p className="mt-1 text-dim">Personne n&apos;a encore parié. Lance-toi.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold">@{a.nickname}</span>{" "}
                      {a.kind === "buy" ? "a parié" : "a revendu"}{" "}
                      <span className="tabular-nums">{formatCoinsFr(a.coins)}</span>{" "}
                      {a.kind === "buy" ? "sur" : "de"}{" "}
                      <span className={`font-semibold ${a.side === "YES" ? "text-yes" : "text-no"}`}>{LABEL[a.side].toLowerCase()}</span>
                    </span>
                    <span className="shrink-0 text-dim">{ago(a.at, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <BetPanel {...trade} />
      </div>
      <BetSheet {...trade} />
    </div>
  );
}

export default function MarketPage({ params }: PageProps<"/marches/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketContent params={params} />
    </Suspense>
  );
}
