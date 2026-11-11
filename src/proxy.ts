import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

/**
 * Runs before every page: refreshes the Supabase session cookie and sends
 * signed-out visitors to the sign-in page. This is a convenience, not the
 * security boundary: every server action checks the session itself.
 */

// The manifest is fetched without cookies, so it must not redirect to sign-in.
const PUBLIC_PATHS = ["/connexion", "/invitation/", "/manifest.webmanifest"];

export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

  if (!signedIn && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = "/connexion";
    target.search = path === "/" ? "" : `?suivant=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(target);
  }
  return response;
}

export const config = {
  // Everything except Next's own files and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
