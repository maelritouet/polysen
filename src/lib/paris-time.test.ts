import { describe, expect, it } from "vitest";
import { parisLocalToDate, toParisLocal } from "./paris-time";

describe("reading a datetime-local value as Paris time", () => {
  it("winter: Paris is UTC+1", () => {
    expect(parisLocalToDate("2026-12-01T18:30")?.toISOString()).toBe("2026-12-01T17:30:00.000Z");
  });

  it("summer: Paris is UTC+2", () => {
    expect(parisLocalToDate("2027-07-14T22:00")?.toISOString()).toBe("2027-07-14T20:00:00.000Z");
  });

  it("around the DST changes", () => {
    expect(parisLocalToDate("2027-03-28T01:30")?.toISOString()).toBe("2027-03-28T00:30:00.000Z");
    expect(parisLocalToDate("2027-03-28T03:30")?.toISOString()).toBe("2027-03-28T01:30:00.000Z");
    expect(parisLocalToDate("2027-03-28T02:30")).toBeNull(); // skipped: clocks jump 02:00 → 03:00
  });

  it("round-trips, and refuses garbage", () => {
    expect(toParisLocal(parisLocalToDate("2026-11-30T23:59")!)).toBe("2026-11-30T23:59");
    expect(parisLocalToDate("demain")).toBeNull();
    expect(parisLocalToDate("2026-02-30T10:00")).toBeNull();
  });
});
