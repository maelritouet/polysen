/**
 * A `<input type="datetime-local">` value ("2026-12-01T18:30") has no time
 * zone. Members mean Paris time, and the server runs in UTC, so convert
 * explicitly. Returns null for anything that isn't a real date and time.
 */
export function parisLocalToDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Paris is UTC+1 or UTC+2. Start from the wall time read as UTC, then correct
  // by the offset Paris actually has at that instant (twice, to settle around DST).
  let t = wanted;
  for (let i = 0; i < 2; i++) t = wanted - parisOffsetMs(new Date(t));
  const check = toParisLocal(new Date(t));
  return check === value ? new Date(t) : null; // e.g. a time skipped by the spring DST change
}

/** The Paris wall time of `date`, formatted for a datetime-local input. */
export function toParisLocal(date: Date): string {
  const parts = Object.fromEntries(PARTS.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

/** A readable Paris date for the UI: "mar. 1 déc., 18:30". */
export function formatParis(date: Date): string {
  return READABLE.format(date);
}

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const READABLE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function parisOffsetMs(date: Date): number {
  const local = toParisLocal(date);
  const [y, mo, d, h, mi] = local.split(/[-T:]/).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(date.getTime() / 60_000) * 60_000;
}
