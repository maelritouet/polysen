"use client";

import { useState } from "react";

/**
 * Shares /m/<id>?invite=<my code>: friends in the group land on the market,
 * anyone else gets the preview and joins through my invite (decision 015).
 * Uses the phone's share sheet when there is one, the clipboard otherwise.
 */
export function ShareButton({ marketId, inviteCode, question }: { marketId: string; inviteCode: string; question: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/m/${marketId}?invite=${encodeURIComponent(inviteCode)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: question, text: `${question} · parie sur Poly'sen`, url });
        return;
      } catch (err) {
        // Closing the share sheet is not an error worth a fallback.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie ce lien :", url);
    }
  }

  return (
    <button type="button" onClick={share} className="font-semibold text-gold underline-offset-4 hover:underline">
      {copied ? "Lien copié !" : "Partager"}
    </button>
  );
}
