import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import Link from "next/link";
import { INVITE_COOKIE, LANDING_COOKIE, landingPath } from "@/lib/invite-cookie";
import { getProfile } from "@/server/members";
import { currentUserId } from "@/server/session";
import { ProfileForm } from "./profile-form";

async function BienvenuePageContent() {
  const userId = await currentUserId();
  if (!userId) redirect("/connexion?suivant=/bienvenue");
  const jar = await cookies();
  // A member who signed back in from a shared link goes straight to that market.
  if (await getProfile(db, userId)) redirect(landingPath(jar.get(LANDING_COOKIE)?.value));
  const code = jar.get(INVITE_COOKIE)?.value ?? "";

  return (
    <Card className="mx-auto mt-8 w-full max-w-md">
      <CardHeader>
        <CardTitle>Bienvenue !</CardTitle>
        <CardDescription>
          Ton prénom et ton pseudo apparaîtront sur tes paris, visibles par tous les membres. Tu commences avec
          1&nbsp;000 pièces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm inviteCode={code} />
        <p className="mt-4 text-xs text-dim">
          Ce qu&apos;on garde sur toi et pourquoi :{" "}
          <Link href="/confidentialite" className="underline">
            confidentialité
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

/** Instant shell; the per-member content streams in (Cache Components). */
export default function BienvenuePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BienvenuePageContent />
    </Suspense>
  );
}
