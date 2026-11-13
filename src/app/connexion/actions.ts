"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { googleSignInEnabled } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { createSupabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; ok?: string } | null;

/** This site's origin, for links Supabase sends people back to. */
async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** The return address after Google or the confirmation e-mail. */
async function callbackUrl(next: string): Promise<string> {
  return `${await origin()}/auth/callback?suivant=${encodeURIComponent(next)}`;
}

function credentials(form: FormData): { email: string; password: string } | { error: string } {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email.includes("@")) return { error: "Adresse e-mail invalide." };
  if (password.length < 8) return { error: "Le mot de passe doit faire au moins 8 caractères." };
  return { email, password };
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const c = credentials(form);
  if ("error" in c) return c;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(c);
  if (error) return { error: "E-mail ou mot de passe incorrect." };
  redirect(safeNext(form.get("suivant")));
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const c = credentials(form);
  if ("error" in c) return c;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({ ...c, options: { emailRedirectTo: await callbackUrl("/bienvenue") } });
  if (error) {
    return { error: error.code === "user_already_exists" ? "Un compte existe déjà avec cet e-mail : connecte-toi." : "Impossible de créer le compte, réessaie." };
  }
  // With e-mail confirmation on, there is no session until the link is clicked.
  if (!data.session) return { ok: "Compte créé ! Clique sur le lien reçu par e-mail pour continuer." };
  redirect("/bienvenue");
}

/** Google sign-in (phase 5d): Supabase sends the person to Google, then back to /auth/callback. */
export async function signInWithGoogle(form: FormData): Promise<void> {
  if (!googleSignInEnabled()) redirect("/connexion");
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(safeNext(form.get("suivant"))) },
  });
  if (error || !data.url) redirect("/connexion?erreur=google");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/connexion");
}
