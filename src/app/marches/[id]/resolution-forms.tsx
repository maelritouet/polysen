"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { disputeResolutionAction, proposeResolutionAction } from "../actions";

const CHOICES = [
  { value: "YES", label: "Oui", tone: "aria-checked:border-yes aria-checked:bg-yes/15 aria-checked:text-yes" },
  { value: "NO", label: "Non", tone: "aria-checked:border-no aria-checked:bg-no/15 aria-checked:text-no" },
  { value: "CANCEL", label: "Annuler", tone: "aria-checked:border-ink aria-checked:bg-secondary" },
] as const;

const field =
  "w-full resize-y rounded-lg border border-line bg-panel/40 px-3 py-2 text-sm placeholder:text-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** For the creator once betting has closed: pick the result and give proof. */
export function ProposeForm({ marketId }: { marketId: string }) {
  const [outcome, setOutcome] = useState<string>();
  const [proof, setProof] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setError((await proposeResolutionAction(marketId, outcome ?? "", proof))?.error));
      }}
    >
      <div role="radiogroup" aria-label="Résultat" className="grid grid-cols-3 gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={outcome === c.value}
            onClick={() => setOutcome(c.value)}
            className={`h-11 rounded-lg border border-line text-sm font-bold text-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${c.tone}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label className="text-sm">
        <span className="text-dim">Ta preuve : un lien vers une photo, un message, un témoin</span>
        <textarea value={proof} onChange={(e) => setProof(e.target.value)} maxLength={500} rows={2} className={`mt-1 ${field}`} />
      </label>
      <div className="flex items-center justify-between gap-3">
        <FormMessage error={error} />
        <Button type="submit" className="ml-auto" disabled={pending || !outcome || proof.trim().length < 3}>
          Proposer ce résultat
        </Button>
      </div>
    </form>
  );
}

/** For players while the dispute window is open. */
export function DisputeForm({ resolutionId }: { resolutionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!open)
    return (
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Contester ce résultat
        </Button>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setError((await disputeResolutionAction(resolutionId, reason))?.error));
      }}
    >
      <label className="text-sm">
        <span className="text-dim">Pourquoi le résultat est faux, en une phrase</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} className={`mt-1 ${field}`} />
      </label>
      <div className="flex items-center justify-between gap-3">
        <FormMessage error={error} />
        <Button type="submit" size="sm" className="ml-auto" disabled={pending || reason.trim().length < 3}>
          Envoyer à l&apos;admin
        </Button>
      </div>
    </form>
  );
}
