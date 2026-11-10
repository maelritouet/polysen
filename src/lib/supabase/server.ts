import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseEnv } from "@/lib/env";

/** Supabase client for server components and server actions. Used for sign-in only, never for data. */
export async function createSupabaseServer() {
  // The Supabase client reads the clock (to check session expiry) as soon as
  // it's created. Declaring the request first tells Next.js this code is
  // per-request, so it never tries to prerender it.
  await connection();
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only.
          // proxy.ts refreshes the session cookies, so this is safe to ignore.
        }
      },
    },
  });
}
