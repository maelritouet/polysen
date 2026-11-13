import { describe, expect, it } from "vitest";
import { isMarketId, landingPath } from "./invite-cookie";

describe("landing after sign-up", () => {
  it("sends the newcomer to the shared market", () => {
    expect(landingPath("0b7e8a4c-1f2d-4e5a-9b6c-7d8e9f0a1b2c")).toBe("/marches/0b7e8a4c-1f2d-4e5a-9b6c-7d8e9f0a1b2c");
  });

  it("falls back to home for anything that is not a market id", () => {
    for (const bad of [undefined, null, "", "//evil.example", "/admin", "../x", "0b7e8a4c-1f2d-4e5a-9b6c-7d8e9f0a1b2c/../admin"]) {
      expect(landingPath(bad)).toBe("/");
    }
  });

  it("recognises market ids", () => {
    expect(isMarketId("0B7E8A4C-1F2D-4E5A-9B6C-7D8E9F0A1B2C")).toBe(true);
    expect(isMarketId("nope")).toBe(false);
  });
});
