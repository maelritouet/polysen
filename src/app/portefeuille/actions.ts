"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteAccount } from "@/server/account";
import { isUserError } from "@/server/errors";
import { requireMember } from "@/server/session";

export type DeleteState = { error?: string } | null;

const CONFIRM_WORD = "SUPPRIMER";

/** Deletes the signed-in member's account (decision 016), then signs them out. */
export async function deleteAccountAction(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const me = await requireMember();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== CONFIRM_WORD) {
    return { error: `Tape ${CONFIRM_WORD} pour confirmer.` };
  }
  try {
    await deleteAccount(db, me.id);
  } catch (err) {
    if (isUserError(err)) return { error: err.message };
    throw err;
  }
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/connexion?supprime=1");
}
