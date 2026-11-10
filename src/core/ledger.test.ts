import { describe, expect, it } from "vitest";
import {
  balanceOf,
  canSpend,
  dailyDropAmount,
  isTradingReason,
  tradingProfit,
  STARTING_GRANT,
  type LedgerEntry,
} from "./ledger";

const e = (memberId: string, amount: bigint, reason: LedgerEntry["reason"]): LedgerEntry => ({
  memberId,
  amount,
  reason,
});

describe("balance", () => {
  it("is the sum of a member's ledger rows, and nobody else's", () => {
    const rows = [
      e("lea", STARTING_GRANT, "grant"),
      e("lea", -2500n, "bet"),
      e("tom", STARTING_GRANT, "grant"),
      e("lea", 4000n, "payout"),
    ];
    expect(balanceOf(rows, "lea")).toBe(STARTING_GRANT - 2500n + 4000n);
    expect(balanceOf(rows, "nobody")).toBe(0n);
  });

  it("a new member starts with 1,000 coins", () => {
    expect(STARTING_GRANT).toBe(100000n);
  });
});

describe("rule 11 (single action): no spending below zero", () => {
  it("allows spending up to the whole balance", () => {
    expect(canSpend(1000n, 1000n)).toBe(true);
    expect(canSpend(1000n, 1n)).toBe(true);
  });

  it("refuses spending more than the balance", () => {
    expect(canSpend(1000n, 1001n)).toBe(false);
    expect(canSpend(0n, 1n)).toBe(false);
  });

  it("refuses zero or negative amounts", () => {
    expect(canSpend(1000n, 0n)).toBe(false);
    expect(canSpend(1000n, -5n)).toBe(false);
  });
});

describe("daily drop", () => {
  it("is 50 coins on the first day of a streak", () => {
    expect(dailyDropAmount(1)).toBe(5000n);
  });

  it("adds 10 coins per consecutive day", () => {
    expect(dailyDropAmount(2)).toBe(6000n);
    expect(dailyDropAmount(3)).toBe(7000n);
  });

  it("caps the streak bonus at +50", () => {
    expect(dailyDropAmount(6)).toBe(10000n);
    expect(dailyDropAmount(30)).toBe(10000n);
  });

  it("refuses a streak below 1 day", () => {
    expect(() => dailyDropAmount(0)).toThrow();
    expect(() => dailyDropAmount(1.5)).toThrow();
  });
});

describe("rule 13 / leaderboard: only trading counts as profit", () => {
  it("counts bets, sales, payouts and refunds", () => {
    for (const r of ["bet", "sale", "payout", "refund"] as const) {
      expect(isTradingReason(r)).toBe(true);
    }
  });

  it("excludes the starting grant, drops, creator bonuses, seeds and seed returns", () => {
    for (const r of ["grant", "drop", "creator_bonus", "seed", "seed_return"] as const) {
      expect(isTradingReason(r)).toBe(false);
    }
  });

  it("a creator's seed return never shows up as trading profit", () => {
    const rows = [
      e("lea", STARTING_GRANT, "grant"),
      e("lea", -10000n, "seed"),
      e("lea", 25000n, "seed_return"),
      e("lea", -1000n, "bet"),
      e("lea", 3000n, "payout"),
      e("lea", 5000n, "drop"),
      e("lea", 1000n, "creator_bonus"),
    ];
    expect(tradingProfit(rows, "lea")).toBe(2000n);
  });
});
