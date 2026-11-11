import { describe, expect, it } from "vitest";
import { ago, closesIn } from "./format-time";

const now = Date.UTC(2026, 11, 1, 12);
const at = (ms: number) => new Date(now + ms);

describe("time wording", () => {
  it("closesIn", () => {
    expect(closesIn(at(-1), now)).toBe("Paris fermés");
    expect(closesIn(at(20_000), now)).toBe("Ferme dans 1 min");
    expect(closesIn(at(45 * 60_000), now)).toBe("Ferme dans 45 min");
    expect(closesIn(at(30 * 3_600_000), now)).toBe("Ferme dans 30 h");
    expect(closesIn(at(5 * 86_400_000), now)).toBe("Ferme dans 5 j");
  });
  it("ago", () => {
    expect(ago(at(-10_000), now)).toBe("à l'instant");
    expect(ago(at(-5 * 60_000), now)).toBe("il y a 5 min");
    expect(ago(at(-3 * 3_600_000), now)).toBe("il y a 3 h");
    expect(ago(at(-50 * 3_600_000), now)).toBe("il y a 2 j");
  });
});
