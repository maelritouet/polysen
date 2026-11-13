import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { displayPercent } from "@/core/amm";
import { D } from "@/core/money";
import type { Db } from "@/db/client";
import { markets, marketTags } from "@/db/schema";

/**
 * What a shared link shows to someone outside the group (decision 015):
 * the question and the odds, nothing about any member.
 */
export interface SharePreview {
  question: string;
  /** The YES probability, 1–99. */
  percent: number;
  status: "open" | "resolved";
  outcome: "YES" | "NO" | null;
  closeAt: Date;
}

/**
 * The public preview of a market, or null when it must stay inside the group.
 * Only open or resolved markets that nobody reported and that name nobody:
 * a market about a person is that person's data, and their approval covers
 * the group, not the whole internet.
 */
export async function getSharePreview(db: Db, marketId: string): Promise<SharePreview | null> {
  const [m] = await db
    .select({
      question: markets.question,
      poolYes: markets.poolYes,
      poolNo: markets.poolNo,
      status: markets.status,
      outcome: markets.outcome,
      closeAt: markets.closeAt,
    })
    .from(markets)
    .where(
      and(
        eq(markets.id, marketId),
        inArray(markets.status, ["open", "resolved"]),
        isNull(markets.hiddenAt),
        sql`not exists (select 1 from ${marketTags} where ${marketTags.marketId} = ${markets.id})`,
      ),
    );
  if (!m) return null;
  return {
    question: m.question,
    percent: displayPercent({ yes: D(m.poolYes), no: D(m.poolNo) }),
    status: m.status as "open" | "resolved",
    outcome: m.outcome,
    closeAt: m.closeAt,
  };
}

/** One line for previews: the odds, or the result once resolved. */
export function oddsLine(p: Pick<SharePreview, "status" | "outcome" | "percent">): string {
  if (p.status === "resolved") return `Résolu : ${p.outcome === "NO" ? "non" : "oui"}`;
  return `${p.percent} % de chances selon le groupe`;
}
