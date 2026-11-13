import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Where Supabase sends people back after Google sign-in or the e-mail
 * confirmation link: /auth/callback?code=…&suivant=/path. Swaps the one-time
 * code for a session cookie (PKCE), then continues. A newcomer without a
 * profile is sent on to /bienvenue by requireMember, invite cookie intact.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeNext(params.get("suivant"));
  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const failed = new URL("/connexion", request.url);
  failed.searchParams.set("erreur", "lien");
  return NextResponse.redirect(failed);
}
