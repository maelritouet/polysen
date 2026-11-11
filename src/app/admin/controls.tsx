"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { FormState } from "./actions";

/** One button running one bound server action, with an optional confirm. */
export function ActionButton({
  action,
  label,
  confirmText,
  variant = "outline",
}: {
  action: () => Promise<FormState>;
  label: string;
  confirmText?: string;
  variant?: "outline" | "default" | "destructive";
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => setError((await action())?.error));
        }}
      >
        {label}
      </Button>
      <FormMessage error={error} />
    </span>
  );
}

/** The admin's ruling on a market: a note for the log, then Oui / Non / Annuler. */
export function RulingForm({
  rule,
  allowYesNo = true,
}: {
  rule: (outcome: "YES" | "NO" | "CANCEL", note: string) => Promise<FormState>;
  allowYesNo?: boolean;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const go = (outcome: "YES" | "NO" | "CANCEL", label: string) => {
    if (!confirm(`Trancher « ${label} » ? Les pièces bougent tout de suite, c'est définitif.`)) return;
    start(async () => setError((await rule(outcome, note))?.error));
  };
  return (
    <div className="flex flex-col gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Ta raison, pour le journal public"
        className="h-9 rounded-lg border border-line bg-panel/40 px-3 text-sm placeholder:text-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {allowYesNo && (
          <>
            <Button size="sm" disabled={pending} onClick={() => go("YES", "Oui")} className="bg-yes text-night hover:bg-yes/90">
              Oui
            </Button>
            <Button size="sm" disabled={pending} onClick={() => go("NO", "Non")} className="bg-no text-night hover:bg-no/90">
              Non
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go("CANCEL", "Annuler et rembourser")}>
          Annuler et rembourser
        </Button>
      </div>
      <FormMessage error={error} />
    </div>
  );
}
