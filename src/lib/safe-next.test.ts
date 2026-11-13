import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/marches/abc?x=1")).toBe("/marches/abc?x=1");
    expect(safeNext("/bienvenue")).toBe("/bienvenue");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "", null, undefined, 42]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
