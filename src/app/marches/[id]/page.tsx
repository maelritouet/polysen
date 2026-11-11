import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D } from "@/core/money";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { formatParis } from "@/lib/paris-time";
import { getMarketDetails } from "@/server/markets";
import { requireMember } from "@/server/session";
import { getBalance } from "@/server/wallet";
import { TagControls } from "./tag-controls";
import { TradeSheet } from "./trade-sheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS: Record<string, string> = {
  pending_approval: "En attente d'accord",
  open: "Ouvert",
  resolved: "Résolu",
  cancelled: "Annulé",
};

async function MarketContent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [m, balance] = await Promise.all([getMarketDetails(db, me.id, id), getBalance(db, me.id)]);
  if (!m) notFound();

  const closed = m.bettingClosed;
  const tradable = m.status === "open" && !closed;
  const myTag = m.tags.find((t) => t.memberId === me.id);
  const yes = D(m.mine?.yes ?? 0);
  const no = D(m.mine?.no ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Marchés
      </Link>
      <Card>
        <CardHeader>
          <CardDescription>
            {STATUS[m.status]}
            {m.status === "open" && closed ? " · paris fermés" : ""} · par @{m.creator.nickname}
          </CardDescription>
          <CardTitle className="text-xl leading-snug">{m.question}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-5xl font-bold tabular-nums">
            {m.percent} %<span className="ml-2 text-base font-normal text-muted-foreground">OUI</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Comment on saura : </span>
            {m.criteria}
          </p>
          <p className="text-sm text-muted-foreground">Fermeture : {formatParis(m.closeAt)}</p>
          {m.tags.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Nommé·es :{" "}
              {m.tags
                .map((t) => `@${t.nickname}${t.status === "approved" ? " ✓" : t.status === "pending" ? " (en attente)" : " (refusé)"}`)
                .join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {myTag && (m.status === "open" || m.status === "pending_approval") && (
        <TagControls marketId={m.id} canRespond={m.status === "pending_approval" && myTag.status === "pending"} />
      )}

      {(yes.gt(0) || no.gt(0)) && (
        <Card>
          <CardHeader>
            <CardDescription>Ta position</CardDescription>
            <CardTitle className="text-base">
              {yes.gt(0) && `${yes.toFixed(2)} parts OUI`}
              {yes.gt(0) && no.gt(0) && " · "}
              {no.gt(0) && `${no.toFixed(2)} parts NON`}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Mis en jeu (paris − ventes) : {formatCoinsFr(m.mine!.invested)} pièces
          </CardContent>
        </Card>
      )}

      {tradable && (
        <TradeSheet
          marketId={m.id}
          balance={formatCoinsFr(balance)}
          holds={{ YES: yes.gt(0), NO: no.gt(0) }}
        />
      )}
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
