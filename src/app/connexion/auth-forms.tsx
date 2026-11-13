"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";

export function AuthForms({ next, startWithSignUp, google }: { next: string; startWithSignUp: boolean; google: boolean }) {
  const [mode, setMode] = useState<"in" | "up">(startWithSignUp ? "up" : "in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, null);
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, null);
  const signingUp = mode === "up";
  const state = signingUp ? upState : inState;
  const pending = signingUp ? upPending : inPending;

  return (
    <div className="flex flex-col gap-4">
      {google && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="suivant" value={next} />
            <Button type="submit" variant="outline" className="w-full">
              Continuer avec Google
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">ou avec ton e-mail</p>
        </>
      )}
      <form action={signingUp ? upAction : inAction} className="flex flex-col gap-4">
        <input type="hidden" name="suivant" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete={signingUp ? "new-password" : "current-password"}
            required
          />
        </div>
        {signingUp && (
          <p className="text-xs text-muted-foreground">
            On garde ton e-mail, ton prénom, ton pseudo et ce que tu fais dans le jeu, rien d&apos;autre.{" "}
            <Link href="/confidentialite" className="underline underline-offset-4">
              Détails
            </Link>
          </p>
        )}
        <FormMessage error={state?.error} ok={state?.ok} />
        <Button type="submit" disabled={pending}>
          {signingUp ? "Créer mon compte" : "Se connecter"}
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4"
          onClick={() => setMode(signingUp ? "in" : "up")}
        >
          {signingUp ? "J'ai déjà un compte" : "Pas encore de compte ? Créer un compte"}
        </button>
      </form>
    </div>
  );
}
