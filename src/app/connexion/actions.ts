"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; ok?: string } | null;

/** Only same-site paths, so a crafted link can't bounce people to another site. */
function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
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
  const { data, error } = await supabase.auth.signUp(c);
  if (error) {
    return { error: error.code === "user_already_exists" ? "Un compte existe déjà avec cet e-mail : connecte-toi." : "Impossible de créer le compte, réessaie." };
  }
  // With e-mail confirmation on, there is no session until the link is clicked.
  if (!data.session) return { ok: "Compte créé ! Clique sur le lien reçu par e-mail pour continuer." };
  redirect("/bienvenue");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/connexion");
}
