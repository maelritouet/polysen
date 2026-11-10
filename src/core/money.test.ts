import { describe, expect, it } from "vitest";
import {
  coinsToDecimal,
  D,
  decimalToCoinsDown,
  decimalToCoinsUp,
  formatCoins,
  parseCoins,
} from "./money";

describe("parseCoins", () => {
  it("reads whole and decimal amounts as hundredths", () => {
    expect(parseCoins("100")).toBe(10000n);
    expect(parseCoins("37.42")).toBe(3742n);
    expect(parseCoins("0.5")).toBe(50n);
    expect(parseCoins("0.01")).toBe(1n);
  });

  it("refuses more than two decimals, so no amount is silently rounded", () => {
    expect(() => parseCoins("1.005")).toThrow();
  });

  it("refuses anything that is not a plain positive or zero number", () => {
    for (const bad of ["", "abc", "1e3", "-5", "1,5", " 1", "Infinity"]) {
      expect(() => parseCoins(bad)).toThrow();
    }
  });
});

describe("formatCoins", () => {
  it("always shows two decimals", () => {
    expect(formatCoins(10000n)).toBe("100.00");
    expect(formatCoins(3742n)).toBe("37.42");
    expect(formatCoins(5n)).toBe("0.05");
    expect(formatCoins(0n)).toBe("0.00");
  });

  it("shows losses with a minus sign", () => {
    expect(formatCoins(-105n)).toBe("-1.05");
    expect(formatCoins(-5n)).toBe("-0.05");
  });

  it("round-trips with parseCoins", () => {
    for (const s of ["0.00", "0.01", "37.42", "1000.00", "123456.78"]) {
      expect(formatCoins(parseCoins(s))).toBe(s);
    }
  });
});

describe("decimal conversion", () => {
  it("converts hundredths to an exact decimal", () => {
    expect(coinsToDecimal(3742n).toString()).toBe("37.42");
  });

  it("rounds down for amounts paid to a player", () => {
    expect(decimalToCoinsDown(D("37.429999"))).toBe(3742n);
    expect(decimalToCoinsDown(D("37.42"))).toBe(3742n);
  });

  it("rounds up for amounts charged by the pool", () => {
    expect(decimalToCoinsUp(D("37.420001"))).toBe(3743n);
    expect(decimalToCoinsUp(D("37.42"))).toBe(3742n);
  });

  it("never pays a negative amount when rounding down", () => {
    expect(() => decimalToCoinsDown(D("-0.001"))).toThrow();
  });
});
