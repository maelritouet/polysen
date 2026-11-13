"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { INVITE_COOKIE, LANDING_COOKIE, landingPath } from "@/lib/invite-cookie";
import { isUserError } from "@/server/errors";
import { createProfile } from "@/server/members";
import { currentUserId } from "@/server/session";

export type ProfileState = { error?: string } | null;

export async function createProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const userId = await currentUserId();
  if (!userId) redirect("/connexion");
  try {
    await createProfile(db, {
      userId,
      inviteCode: String(form.get("inviteCode") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      nickname: String(form.get("nickname") ?? ""),
    });
  } catch (err) {
    if (isUserError(err)) return { error: err.message };
    throw err;
  }
  const jar = await cookies();
  const landing = landingPath(jar.get(LANDING_COOKIE)?.value);
  jar.delete(INVITE_COOKIE);
  jar.delete(LANDING_COOKIE);
  redirect(landing);
}
