import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getProfile, type Profile } from "./members";

/** The signed-in Supabase user id, verified from the session token. Null if signed out. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/** For pages and actions that need a full member: sends anyone else where they belong. */
export async function requireMember(): Promise<Profile> {
  const userId = await currentUserId();
  if (!userId) redirect("/connexion");
  const profile = await getProfile(db, userId);
  if (!profile) redirect("/bienvenue");
  if (profile.suspendedAt) redirect("/connexion?suspendu=1");
  return profile;
}

/** For the admin page: anyone else gets a 404, as if it didn't exist. Server functions check the role again. */
export async function requireAdmin(): Promise<Profile> {
  const me = await requireMember();
  if (me.role !== "admin") notFound();
  return me;
}
