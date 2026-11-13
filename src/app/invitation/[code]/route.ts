import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, isMarketId, LANDING_COOKIE } from "@/lib/invite-cookie";

/**
 * An invite link: /invitation/ABCD2345, optionally ?marche=<id> when it came
 * from a shared market. Remembers the code (and the market) in cookies, then
 * sends the newcomer to sign up. The code itself is only checked when the
 * profile is created, by the server.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/invitation/[code]">) {
  const { code } = await ctx.params;
  const response = NextResponse.redirect(new URL("/bienvenue", request.url));
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: "/",
  };
  response.cookies.set(INVITE_COOKIE, code.slice(0, 32), cookie);
  const market = request.nextUrl.searchParams.get("marche");
  if (isMarketId(market)) response.cookies.set(LANDING_COOKIE, market, cookie);
  return response;
}
