/** Public Supabase settings (safe in the browser: the publishable key grants nothing, see RLS). */
export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set (see .env.example)");
  return { url, key };
}

/**
 * Google sign-in shows only once the provider is set up in Supabase
 * (GOOGLE_SIGN_IN=on, phase 5d). Until then the button would only lead to an error.
 */
export function googleSignInEnabled(): boolean {
  return process.env.GOOGLE_SIGN_IN === "on";
}
