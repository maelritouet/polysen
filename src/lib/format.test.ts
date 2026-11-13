import { describe, expect, it } from "vitest";
import { formatCoinsFr } from "./format";

const NNBSP = " "; // narrow no-break space, the French thousands separator

describe("formatCoinsFr", () => {
  it("uses a comma for decimals and always shows two", () => {
    expect(formatCoinsFr(3742n)).toBe("37,42");
    expect(formatCoinsFr(5n)).toBe("0,05");
    expect(formatCoinsFr(0n)).toBe("0,00");
  });

  it("groups thousands with a narrow no-break space", () => {
    expect(formatCoinsFr(100000n)).toBe(`1${NNBSP}000,00`);
    expect(formatCoinsFr(123456789n)).toBe(`1${NNBSP}234${NNBSP}567,89`);
  });

  it("shows losses with a minus sign, and gains with a plus when asked", () => {
    expect(formatCoinsFr(-100000n)).toBe(`−1${NNBSP}000,00`);
    expect(formatCoinsFr(5000n, { sign: true })).toBe("+50,00");
    expect(formatCoinsFr(0n, { sign: true })).toBe("0,00");
  });
});

describe("formatSharesFr", () => {
  it("rounds down to 2 decimals with a French comma and grouped thousands", async () => {
    const { formatSharesFr } = await import("./format");
    const { D } = await import("@/core/money");
    expect(formatSharesFr(D("134.729"))).toBe("134,72");
    expect(formatSharesFr(D("12345.5"))).toBe(`12${NNBSP}345,50`);
  });
});
