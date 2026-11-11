import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BetPanel } from "@/components/market/bet-panel";
import { BetSheet } from "@/components/market/bet-sheet";
import { PriceChart } from "@/components/market/price-chart";
import { SellButton } from "@/components/market/sell-button";
import { PageSkeleton } from "@/components/page-skeleton";
import type { Side } from "@/core/amm";
import { D, decimalToCoinsDown } from "@/core/money";
import { db } from "@/db";
import { formatCoinsFr, formatSharesFr } from "@/lib/format";
import { ago, closesIn } from "@/lib/format-time";
import { formatParis } from "@/lib/paris-time";
import { getActivity, getPriceHistory } from "@/server/history";
import { getMarketDetails } from "@/server/markets";
import { requireMember } from "@/server/session";
import { quoteSellFor } from "@/server/trading";
import { getBalance } from "@/server/wallet";
import { TagControls } from "./tag-controls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL: Record<Side, string> = { YES: "Oui", NO: "Non" };

async function MarketContent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const m = await getMarketDetails(db, me.id, id);
  if (!m) notFound();
  const [balance, history, activity] = await Promise.all([
    getBalance(db, me.id),
    getPriceHistory(db, id),
    getActivity(db, id),
  ]);
  const now = m.asOf.getTime();

  const tradable = m.status === "open" && !m.bettingClosed;
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
        ? "Les paris sont fermés. Résultat bientôt."
        : m.status === "cancelled"
          ? "Marché annulé : tout le monde a été remboursé."
          : "Marché résolu.";

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
            <p className="flex flex-wrap gap-x-3 text-sm text-dim">
              <span>Lancé par @{m.creator.nickname}</span>
              <span title={formatParis(m.closeAt)}>{m.status === "open" ? closesIn(m.closeAt, now) : closedReason}</span>
            </p>
            <h1 className="mt-2 text-2xl leading-tight font-bold text-balance lg:text-3xl">{m.question}</h1>
          </div>

          <PriceChart points={history} now={now} end={now} />

          {myTag && (m.status === "open" || m.status === "pending_approval") && (
            <TagControls marketId={m.id} canRespond={m.status === "pending_approval" && myTag.status === "pending"} />
          )}

          {sides.length > 0 && (
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
