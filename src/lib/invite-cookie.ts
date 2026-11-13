/** Cookie that remembers which invite link a newcomer arrived from. */
export const INVITE_COOKIE = "polysen_invite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // a week

/**
 * Cookie that remembers which market a shared link pointed at, so a newcomer
 * lands on it after signing up. It holds a market id only, never a path.
 */
export const LANDING_COOKIE = "polysen_landing";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMarketId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Where to send a member after sign-up: the shared market, or home. Never another site. */
export function landingPath(cookieValue: string | null | undefined): string {
  return isMarketId(cookieValue) ? `/marches/${cookieValue.toLowerCase()}` : "/";
}
