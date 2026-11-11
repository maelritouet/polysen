"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { claimDropAction, type DropState } from "./actions";

export function DropButton({ claimed }: { claimed: boolean }) {
  const [state, action, pending] = useActionState<DropState, FormData>(claimDropAction, null);
  const done = claimed || Boolean(state?.ok);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="outline" disabled={pending || done} className="h-11 rounded-xl border-yes/40 text-yes">
        {done ? "Récompense du jour récupérée" : "Récupérer ma récompense du jour"}
      </Button>
      <FormMessage error={state?.error} ok={state?.ok} />
    </form>
  );
}
