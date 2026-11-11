const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "Ferme dans 3 h", or "Paris fermés" once closed. */
export function closesIn(closeAt: Date, now: number): string {
  const ms = closeAt.getTime() - now;
  if (ms <= 0) return "Paris fermés";
  if (ms < HOUR) return `Ferme dans ${Math.max(1, Math.floor(ms / MIN))} min`;
  if (ms < 2 * DAY) return `Ferme dans ${Math.floor(ms / HOUR)} h`;
  return `Ferme dans ${Math.floor(ms / DAY)} j`;
}

/** "il y a 5 min". */
export function ago(at: Date, now: number): string {
  const ms = Math.max(0, now - at.getTime());
  if (ms < MIN) return "à l'instant";
  if (ms < HOUR) return `il y a ${Math.floor(ms / MIN)} min`;
  if (ms < DAY) return `il y a ${Math.floor(ms / HOUR)} h`;
  return `il y a ${Math.floor(ms / DAY)} j`;
}
