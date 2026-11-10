"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { formatCoinsFr } from "@/lib/format";
import { isUserError } from "@/server/errors";
import { rotateInviteCode } from "@/server/members";
import { requireMember } from "@/server/session";
import { claimDailyDrop } from "@/server/wallet";

export type DropState = { error?: string; ok?: string } | null;

export async function claimDropAction(_prev: DropState): Promise<DropState> {
  const me = await requireMember();
  try {
    const { amount, streak } = await claimDailyDrop(db, me.id);
    revalidatePath("/");
    revalidatePath("/portefeuille");
    const streakText = streak > 1 ? ` Série de ${streak} jours !` : "";
    return { ok: `+${formatCoinsFr(amount)} pièces.${streakText}` };
  } catch (err) {
    if (isUserError(err)) return { error: err.message };
    throw err;
  }
}

export async function rotateInviteAction(): Promise<void> {
  const me = await requireMember();
  await rotateInviteCode(db, me.id);
  revalidatePath("/portefeuille");
}
