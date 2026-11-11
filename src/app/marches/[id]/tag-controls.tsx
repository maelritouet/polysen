"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { removeMarketAction, respondToTagAction } from "../actions";

/** For a member named in the market: approve or refuse it, or remove it later. */
export function TagControls({ marketId, canRespond }: { marketId: string; canRespond: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string } | null>) =>
    start(async () => setError((await fn())?.error));

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {canRespond
            ? "Tu es nommé·e dans ce marché. Personne d'autre ne le voit tant que tu n'as pas accepté."
            : "Tu es nommé·e dans ce marché. Tu peux le retirer à tout moment : tout le monde est remboursé."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        {canRespond ? (
          <>
            <Button disabled={pending} onClick={() => run(() => respondToTagAction(marketId, true))}>
              J&apos;accepte
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => respondToTagAction(marketId, false))}>
              Je refuse
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Retirer ce marché ? Il sera annulé et tout le monde remboursé.")) run(() => removeMarketAction(marketId));
            }}
          >
            Retirer ce marché
          </Button>
        )}
        <FormMessage error={error} />
      </CardContent>
    </Card>
  );
}
