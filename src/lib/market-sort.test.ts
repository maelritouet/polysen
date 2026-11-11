import { describe, expect, it } from "vitest";
import { closingSoon, parseSort, sortMarkets } from "./market-sort";

const H = 3_600_000;
const now = Date.UTC(2026, 11, 1, 12);
const m = (id: string, o: { created?: number; close?: number; v24?: bigint; v?: bigint; status?: string }) => ({
  id,
  status: o.status ?? "open",
  createdAt: new Date(now - (o.created ?? 0) * H),
  closeAt: new Date(now + (o.close ?? 100) * H),
  volume24h: o.v24 ?? 0n,
  volume: o.v ?? 0n,
});

describe("ordering markets", () => {
  const list = [m("a", { created: 5, close: 30, v24: 100n, v: 900n }), m("b", { created: 1, close: 10, v24: 500n, v: 500n }), m("c", { created: 3, close: 70, v24: 100n, v: 2000n })];

  it("tendance: 24 h volume, then total volume", () => {
    expect(sortMarkets(list, "tendance").map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("nouveaux: newest first", () => {
    expect(sortMarkets(list, "nouveaux").map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("bientôt fermés: soonest close first", () => {
    expect(sortMarkets(list, "bientot").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
  it("unknown sort falls back to tendance", () => {
    expect(parseSort("n'importe quoi")).toBe("tendance");
    expect(parseSort(undefined)).toBe("tendance");
    expect(parseSort("bientot")).toBe("bientot");
  });
});

describe("closing soon", () => {
  it("keeps open markets closing within 48 h, soonest first", () => {
    const list = [m("late", { close: 60 }), m("soon", { close: 2 }), m("mid", { close: 40 }), m("pending", { close: 1, status: "pending_approval" }), m("past", { close: -1 })];
    expect(closingSoon(list, now).map((x) => x.id)).toEqual(["soon", "mid"]);
  });
});
