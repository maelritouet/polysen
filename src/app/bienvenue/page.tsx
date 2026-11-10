import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { INVITE_COOKIE } from "@/lib/invite-cookie";
import { getProfile } from "@/server/members";
import { currentUserId } from "@/server/session";
import { ProfileForm } from "./profile-form";

export default async function BienvenuePage() {
  const userId = await currentUserId();
  if (!userId) redirect("/connexion?suivant=/bienvenue");
  if (await getProfile(db, userId)) redirect("/");
  const code = (await cookies()).get(INVITE_COOKIE)?.value ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bienvenue !</CardTitle>
        <CardDescription>
          Ton prénom et ton pseudo apparaîtront sur tes paris, visibles par tous les membres. Tu commences avec
          1&nbsp;000 pièces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm inviteCode={code} />
      </CardContent>
    </Card>
  );
}
