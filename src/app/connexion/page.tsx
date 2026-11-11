import { cookies } from "next/headers";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { INVITE_COOKIE } from "@/lib/invite-cookie";
import { inviterForCode } from "@/server/members";
import { AuthForms } from "./auth-forms";

/** The static frame renders instantly; the part that reads the URL and cookies streams in. */
export default function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8">
      <h1 className="text-3xl font-bold tracking-tight">Poly&apos;sen</h1>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignIn({ searchParams }: { searchParams: PageProps<"/connexion">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.suivant === "string" ? params.suivant : "/";
  const suspended = params.suspendu === "1";
  const code = (await cookies()).get(INVITE_COOKIE)?.value;
  const inviter = code ? await inviterForCode(db, code) : null;

  return (
    <>
      {inviter && (
        <p className="rounded-lg bg-muted p-3 text-sm">
          <strong>{inviter.firstName}</strong> ({inviter.nickname}) t&apos;invite à rejoindre le jeu.
        </p>
      )}
      {suspended && <p className="text-sm text-destructive">Ton compte est suspendu. Parle à un admin.</p>}
      <Card>
        <CardHeader>
          <CardTitle>{inviter ? "Crée ton compte" : "Connexion"}</CardTitle>
          <CardDescription>Pas d&apos;argent réel : on joue avec des pièces pour de faux.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForms next={next} startWithSignUp={Boolean(inviter)} />
        </CardContent>
      </Card>
    </>
  );
}
