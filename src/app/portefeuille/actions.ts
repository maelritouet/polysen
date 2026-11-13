"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteAccount } from "@/server/account";
import { isUserError } from "@/server/errors";
import { removePhoto, setPhoto } from "@/server/photos";
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

export type PhotoState = { error?: string; ok?: string } | null;

/** Saves a new profile photo (decision 018). The browser shrinks it first; the server re-encodes it anyway. */
export async function uploadPhotoAction(_prev: PhotoState, form: FormData): Promise<PhotoState> {
  const me = await requireMember();
  const file = form.get("photo");
  if (!(file instanceof File)) return { error: "Choisis une photo." };
  try {
    await setPhoto(db, me.id, new Uint8Array(await file.arrayBuffer()));
  } catch (err) {
    if (isUserError(err)) return { error: err.message };
    throw err;
  }
  revalidatePath("/portefeuille");
  return { ok: "Photo enregistrée." };
}

export async function removePhotoAction(): Promise<void> {
  const me = await requireMember();
  await removePhoto(db, me.id);
  revalidatePath("/portefeuille");
}
