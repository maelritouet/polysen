import { describe, expect, it } from "vitest";
import { parisDate, previousDay } from "./time";

describe("parisDate: the calendar day in Paris", () => {
  it("in winter (UTC+1), 23:30 UTC is already the next day in Paris", () => {
    expect(parisDate(new Date("2026-01-15T22:59:00Z"))).toBe("2026-01-15");
    expect(parisDate(new Date("2026-01-15T23:00:00Z"))).toBe("2026-01-16");
  });

  it("in summer (UTC+2), the day changes at 22:00 UTC", () => {
    expect(parisDate(new Date("2026-07-15T21:59:00Z"))).toBe("2026-07-15");
    expect(parisDate(new Date("2026-07-15T22:00:00Z"))).toBe("2026-07-16");
  });

  it("handles the night the clocks go forward (29 March 2026)", () => {
    // 01:59 UTC = 03:59 Paris, after the jump from 02:00 to 03:00.
    expect(parisDate(new Date("2026-03-28T22:59:00Z"))).toBe("2026-03-28");
    expect(parisDate(new Date("2026-03-28T23:00:00Z"))).toBe("2026-03-29");
    expect(parisDate(new Date("2026-03-29T21:59:00Z"))).toBe("2026-03-29");
    expect(parisDate(new Date("2026-03-29T22:00:00Z"))).toBe("2026-03-30");
  });

  it("handles the night the clocks go back (25 October 2026)", () => {
    expect(parisDate(new Date("2026-10-24T21:59:00Z"))).toBe("2026-10-24");
    expect(parisDate(new Date("2026-10-24T22:00:00Z"))).toBe("2026-10-25");
    expect(parisDate(new Date("2026-10-25T22:59:00Z"))).toBe("2026-10-25");
    expect(parisDate(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26");
  });
});

describe("previousDay", () => {
  it("steps back one calendar day, across months, years and leap days", () => {
    expect(previousDay("2026-11-10")).toBe("2026-11-09");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2028-03-01")).toBe("2028-02-29");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });

  it("refuses anything that isn't a YYYY-MM-DD date", () => {
    expect(() => previousDay("10/11/2026")).toThrow();
    expect(() => previousDay("2026-13-01")).toThrow();
  });
});
