"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { deleteAccountAction, type DeleteState } from "./actions";

/** Tucked away behind a disclosure, and confirmed by typing a word: it can't be undone. */
export function DeleteAccount() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccountAction, null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-dim underline underline-offset-4">Supprimer mon compte</summary>
      <form action={action} className="mt-3 flex flex-col gap-3 rounded-xl border border-no/50 p-4">
        <p className="text-dim">
          Ton e-mail, ton prénom et ton pseudo seront effacés et tu ne pourras plus te connecter. Tes anciens paris restent dans
          les totaux, sous un nom anonyme. Les marchés en cours qui te nomment seront annulés et remboursés. C&apos;est définitif.
        </p>
        <label htmlFor="confirm" className="font-semibold">
          Tape SUPPRIMER pour confirmer
        </label>
        <Input id="confirm" name="confirm" autoComplete="off" autoCapitalize="characters" required />
        <FormMessage error={state?.error} />
        <button type="submit" disabled={pending} className="rounded-lg bg-no px-4 py-2 font-bold text-night disabled:opacity-50">
          Supprimer définitivement
        </button>
      </form>
    </details>
  );
}
