import { describe, expect, it } from "vitest";
import { seasonOf, weekOf } from "./periods";

const iso = (d: Date) => d.toISOString();

describe("leaderboard weeks (Monday 00:00 Paris)", () => {
  it("runs Monday to Monday, midnight Paris time", () => {
    // Wednesday 11 November 2026, 23:45 Paris = 22:45 UTC (winter time).
    const w = weekOf(new Date("2026-11-11T22:45:00Z"));
    expect(iso(w.start)).toBe("2026-11-08T23:00:00.000Z");
    expect(iso(w.end)).toBe("2026-11-15T23:00:00.000Z");
  });

  it("puts Sunday 23:30 Paris in the old week and Monday 00:10 in the new one", () => {
    expect(iso(weekOf(new Date("2026-11-15T22:30:00Z")).start)).toBe("2026-11-08T23:00:00.000Z");
    expect(iso(weekOf(new Date("2026-11-15T23:10:00Z")).start)).toBe("2026-11-15T23:00:00.000Z");
  });

  it("handles the switch to summer time inside a week", () => {
    // Clocks go forward on Sunday 29 March 2026: the week is 167 hours long.
    const w = weekOf(new Date("2026-03-25T12:00:00Z"));
    expect(iso(w.start)).toBe("2026-03-22T23:00:00.000Z");
    expect(iso(w.end)).toBe("2026-03-29T22:00:00.000Z");
  });
});

describe("leaderboard seasons (semesters)", () => {
  it("autumn runs 1 September to 1 February, across the new year", () => {
    for (const at of ["2026-09-01T00:00:00+02:00", "2026-12-31T12:00:00Z", "2027-01-31T22:00:00Z"]) {
      const s = seasonOf(new Date(at));
      expect(iso(s.start)).toBe("2026-08-31T22:00:00.000Z");
      expect(iso(s.end)).toBe("2027-01-31T23:00:00.000Z");
    }
  });

  it("spring runs 1 February to 1 September", () => {
    const s = seasonOf(new Date("2027-02-01T00:30:00+01:00"));
    expect(iso(s.start)).toBe("2027-01-31T23:00:00.000Z");
    expect(iso(s.end)).toBe("2027-08-31T22:00:00.000Z");
  });
});
