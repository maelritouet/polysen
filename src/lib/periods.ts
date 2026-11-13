import { parisDate } from "@/core/time";
import { parisLocalToDate } from "./paris-time";

/**
 * Leaderboard periods, in Paris time (decision 011):
 *   - a week starts Monday 00:00;
 *   - a season is a semester: 1 September → 1 February, 1 February → 1 September.
 * Each period is [start, end).
 */
export interface Period {
  start: Date;
  end: Date;
}

const midnight = (y: number, m: number, d: number) => {
  const day = new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
  return parisLocalToDate(`${day}T00:00`)!;
};

export function weekOf(now: Date): Period {
  const [y, m, d] = parisDate(now).split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  return { start: midnight(y, m, d - weekday), end: midnight(y, m, d - weekday + 7) };
}

export function seasonOf(now: Date): Period {
  const [y, m] = parisDate(now).split("-").map(Number);
  if (m >= 9) return { start: midnight(y, 9, 1), end: midnight(y + 1, 2, 1) };
  if (m === 1) return { start: midnight(y - 1, 9, 1), end: midnight(y, 2, 1) };
  return { start: midnight(y, 2, 1), end: midnight(y, 9, 1) };
}
