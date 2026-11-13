"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { reportCommentAction, reportMarketAction } from "../actions";

/**
 * « Signaler »: a market report hides the market until the admin looks
 * (PRD), so its reporter goes back home; a comment report just tells the admin.
 */
export function ReportButton({ target, id }: { target: "market" | "comment"; id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (sent) return <span className="text-xs text-dim">Merci, l&apos;admin va regarder.</span>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-dim hover:text-ink">
        Signaler
      </button>
    );
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = target === "market" ? await reportMarketAction(id, reason) : await reportCommentAction(id, reason);
          setError(res?.error);
          if (!res?.error) {
            setSent(true);
            if (target === "market") router.push("/");
          }
        });
      }}
    >
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder={target === "market" ? "Pourquoi ? Le marché sera masqué en attendant l'admin." : "Pourquoi ?"}
        className="h-9 rounded-lg border border-line bg-panel/40 px-3 text-sm placeholder:text-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={pending || reason.trim().length < 3}>
          Signaler
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <FormMessage error={error} />
      </div>
    </form>
  );
}
