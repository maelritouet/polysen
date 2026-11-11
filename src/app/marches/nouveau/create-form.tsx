"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMarketAction, type FormState } from "../actions";

interface Props {
  members: Array<{ id: string; firstName: string; nickname: string }>;
  rules: string;
  defaultClose: string;
  minClose: string;
}

export function CreateMarketForm({ members, rules, defaultClose, minClose }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createMarketAction, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="question">La question</Label>
        <Input id="question" name="question" placeholder="Le partiel de mardi sera-t-il dur ?" minLength={5} maxLength={200} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="criteria">Comment on saura ?</Label>
        <Input id="criteria" name="criteria" placeholder="Vote de la promo juste après l'épreuve." minLength={3} maxLength={300} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="closeAt">Fermeture des paris (heure de Paris)</Label>
        <Input id="closeAt" name="closeAt" type="datetime-local" defaultValue={defaultClose} min={minClose} required />
        <p className="text-xs text-muted-foreground">Entre 1 heure et 3 mois.</p>
      </div>
      {members.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Nommer quelqu&apos;un (facultatif)</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Si ta question parle de quelqu&apos;un, nomme-le : le marché reste invisible tant qu&apos;il n&apos;a pas accepté.
          </p>
          <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tags" value={m.id} className="size-4" />
                {m.firstName} <span className="text-muted-foreground">@{m.nickname}</span>
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
        <p>{rules}</p>
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" name="acceptedRules" required className="size-4" />
          J&apos;accepte les règles.
        </label>
      </div>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending}>
        Lancer le marché (100 pièces)
      </Button>
    </form>
  );
}
