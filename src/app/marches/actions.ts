"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Side } from "@/core/amm";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { parisLocalToDate } from "@/lib/paris-time";
import { isUserError } from "@/server/errors";
import { createMarket, getVisibleMarket, removeMyMarket, respondToTag } from "@/server/markets";
import { requireMember } from "@/server/session";
import { buy, heldShares, quoteBuyFor, quoteSellFor, sell, sharesForPercent } from "@/server/trading";

/**
 * Market and trading actions. Each one checks the session itself
 * (requireMember); the server functions do every coin rule and lock.
 * Amounts cross the wire as strings: bigint and Decimal don't serialize.
 */

export type FormState = { error?: string } | null;

function userErrorOr(err: unknown): { error: string } {
  if (isUserError(err)) return { error: err.message };
  throw err;
}

const asSide = (v: unknown): Side => {
  if (v === "YES" || v === "NO") return v;
  throw new Error("Invalid side");
};

/** Whole coins typed by the member, as hundredths. */
function wholeCoins(text: string): bigint | null {
  return /^\d{1,7}$/.test(text.trim()) ? BigInt(text.trim()) * 100n : null;
}

export async function createMarketAction(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireMember();
  const closeAt = parisLocalToDate(String(form.get("closeAt") ?? ""));
  if (!closeAt) return { error: "Choisis une date et une heure de fermeture." };
  let id: string;
  try {
    ({ id } = await createMarket(db, me.id, {
      question: String(form.get("question") ?? ""),
      criteria: String(form.get("criteria") ?? ""),
      closeAt,
      tagIds: form.getAll("tags").map(String).filter(Boolean),
      acceptedRules: form.get("acceptedRules") === "on",
    }));
  } catch (err) {
    return userErrorOr(err);
  }
  revalidatePath("/");
  redirect(`/marches/${id}`);
}

export async function respondToTagAction(marketId: string, approve: boolean): Promise<FormState> {
  const me = await requireMember();
  try {
    await respondToTag(db, me.id, marketId, approve);
  } catch (err) {
    return userErrorOr(err);
  }
  revalidatePath(`/marches/${marketId}`);
  revalidatePath("/");
  return null;
}

export async function removeMarketAction(marketId: string): Promise<FormState> {
  const me = await requireMember();
  try {
    await removeMyMarket(db, me.id, marketId);
  } catch (err) {
    return userErrorOr(err);
  }
  revalidatePath("/");
  redirect("/");
}

export type BuyQuote = { shares: string; percentAfter: number; payoutAtLeast: string } | { error: string };
export type SellQuote = { proceeds: string; percentAfter: number } | { error: string };
export type TradeOutcome = { ok: string } | { error: string };

async function checkVisible(memberId: string, marketId: string) {
  if (!(await getVisibleMarket(db, memberId, marketId))) throw new Error("Market not visible");
}

export async function quoteBuyAction(marketId: string, side: Side, coinsText: string): Promise<BuyQuote> {
  const me = await requireMember();
  await checkVisible(me.id, marketId);
  const coins = wholeCoins(coinsText);
  if (coins === null) return { error: "Mise en pièces entières." };
  try {
    const q = await quoteBuyFor(db, marketId, asSide(side), coins);
    return { shares: q.shares.toFixed(2), percentAfter: q.percentAfter, payoutAtLeast: formatCoinsFr(q.payoutAtLeast) };
  } catch (err) {
    return userErrorOr(err);
  }
}

export async function quoteSellAction(marketId: string, side: Side, percent: number): Promise<SellQuote> {
  const me = await requireMember();
  await checkVisible(me.id, marketId);
  try {
    const held = await heldShares(db, marketId, me.id, asSide(side));
    const q = await quoteSellFor(db, marketId, me.id, side, sharesForPercent(percent, held));
    return { proceeds: formatCoinsFr(q.proceeds), percentAfter: q.percentAfter };
  } catch (err) {
    return userErrorOr(err);
  }
}

export async function buyAction(marketId: string, side: Side, coinsText: string, requestId: string): Promise<TradeOutcome> {
  const me = await requireMember();
  const coins = wholeCoins(coinsText);
  if (coins === null) return { error: "Mise en pièces entières." };
  try {
    const r = await buy(db, me.id, { marketId, side: asSide(side), coins, requestId });
    revalidatePath(`/marches/${marketId}`);
    return { ok: `Pari placé : ${r.shares.toFixed(2)} parts ${side === "YES" ? "OUI" : "NON"}. Le marché est à ${r.percentAfter} %.` };
  } catch (err) {
    return userErrorOr(err);
  }
}

export async function sellAction(marketId: string, side: Side, percent: number, requestId: string): Promise<TradeOutcome> {
  const me = await requireMember();
  try {
    const held = await heldShares(db, marketId, me.id, asSide(side));
    const r = await sell(db, me.id, { marketId, side, shares: sharesForPercent(percent, held), requestId });
    revalidatePath(`/marches/${marketId}`);
    return { ok: `Vendu pour ${formatCoinsFr(r.coins)} pièces. Le marché est à ${r.percentAfter} %.` };
  } catch (err) {
    return userErrorOr(err);
  }
}
