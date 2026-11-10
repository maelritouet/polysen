import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE } from "@/lib/invite-cookie";

/**
 * An invite link: /invitation/ABCD2345. Remembers the code in a cookie, then
 * sends the newcomer to sign up. The code itself is only checked when the
 * profile is created, by the server.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/invitation/[code]">) {
  const { code } = await ctx.params;
  const response = NextResponse.redirect(new URL("/bienvenue", request.url));
  response.cookies.set(INVITE_COOKIE, code.slice(0, 32), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
