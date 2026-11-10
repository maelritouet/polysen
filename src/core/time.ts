/**
 * Calendar days in Paris time. The daily drop resets at midnight in Paris,
 * whatever the server's own time zone (Vercel runs in UTC).
 * Days are plain "YYYY-MM-DD" strings, which compare and store cleanly.
 */

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The day it is in Paris at `now`, as "YYYY-MM-DD". */
export function parisDate(now: Date): string {
  return PARIS_DAY.format(now); // en-CA formats as YYYY-MM-DD
}

const DAY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day before `day` ("YYYY-MM-DD"). */
export function previousDay(day: string): string {
  const m = DAY_FORMAT.exec(day);
  if (!m) throw new Error(`Not a YYYY-MM-DD day: "${day}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new Error(`Not a real day: "${day}"`);
  }
  // Pure calendar arithmetic in UTC: no time zone, so no DST surprises.
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
