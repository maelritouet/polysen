import { describe, expect, it } from "vitest";
import { newPool, quoteBuy, quoteSell, type Side } from "./amm";
import { D, type Coins } from "./money";
import { cancelRefunds, checkBook, coinsIn, resolvePayouts, type MarketBook, type Transfer } from "./settlement";

const SEED = 10000n; // 100 coins

/** Builds a market by replaying trades, the same way the server will. */
function book(trades: Array<[player: string, kind: "buy" | "sell", side: Side, amount: bigint | string]>): MarketBook {
  let pool = newPool(SEED);
  const positions = new Map<string, { yes: ReturnType<typeof D>; no: ReturnType<typeof D>; invested: Coins }>();
  for (const [player, kind, side, amount] of trades) {
    const pos = positions.get(player) ?? { yes: D(0), no: D(0), invested: 0n };
    if (kind === "buy") {
      const q = quoteBuy(pool, side, amount as bigint);
      pool = q.pool;
      pos[side === "YES" ? "yes" : "no"] = pos[side === "YES" ? "yes" : "no"].plus(q.shares);
      pos.invested += amount as bigint;
    } else {
      const held = side === "YES" ? pos.yes : pos.no;
      const shares = amount === "all" ? held : D(amount as string);
      const q = quoteSell(pool, side, shares);
      pool = q.pool;
      pos[side === "YES" ? "yes" : "no"] = pos[side === "YES" ? "yes" : "no"].minus(shares);
      pos.invested -= q.proceeds;
    }
    positions.set(player, pos);
  }
  return { pool, seed: SEED, creatorId: "creator", positions };
}

const total = (ts: Transfer[]) => ts.reduce((s, t) => s + t.amount, 0n);
const to = (ts: Transfer[], id: string, reason?: Transfer["reason"]) =>
  ts.filter((t) => t.memberId === id && (!reason || t.reason === reason)).reduce((s, t) => s + t.amount, 0n);

describe("the book", () => {
  it("counts coins in as seed + bets − sales", () => {
    const b = book([
      ["lea", "buy", "YES", 10000n],
      ["tom", "buy", "NO", 5000n],
    ]);
    expect(coinsIn(b)).toBe(25000n);
  });

  it("refuses to settle a book whose shares don't match its coins", () => {
    const b = book([["lea", "buy", "YES", 10000n]]);
    const lea = b.positions.get("lea")!;
    const tampered: MarketBook = {
      ...b,
      positions: new Map([["lea", { ...lea, yes: lea.yes.plus("0.000000000001") }]]),
    };
    expect(() => checkBook(tampered)).toThrow();
    expect(() => resolvePayouts(tampered, "YES")).toThrow();
  });
});

/** A winner's base payout: 1 coin per share, rounded down to the hundredth. */
const base = (shares: ReturnType<typeof D>) => BigInt(shares.mul(100).floor().toFixed(0));

describe("rule 8: a winning share pays at least 1 coin, a losing share pays 0", () => {
  it("when the crowd was right, pays each winner exactly their shares, rounded down", () => {
    const b = book([
      ["lea", "buy", "YES", 10000n],
      ["tom", "buy", "NO", 3000n],
    ]);
    const lea = b.positions.get("lea")!;
    const ts = resolvePayouts(b, "YES");
    expect(to(ts, "lea", "payout")).toBe(base(lea.yes));
    expect(to(ts, "tom")).toBe(0n);
  });

  it("when the crowd was wrong, pays each winner their shares plus a share of the surplus", () => {
    const b = book([
      ["tom", "buy", "YES", 30000n],
      ["sam", "buy", "NO", 2000n],
    ]);
    const sam = b.positions.get("sam")!;
    const ts = resolvePayouts(b, "NO");
    expect(to(ts, "sam", "payout")).toBeGreaterThan(base(sam.no));
    expect(to(ts, "tom")).toBe(0n);
  });
});

describe("rule 12 (settlement): every coin in the market is paid out, to the hundredth", () => {
  it("on a YES resolution and on a NO resolution (the creator bonus is new coins, not market coins)", () => {
    const b = book([
      ["lea", "buy", "YES", 12345n],
      ["tom", "buy", "NO", 6789n],
      ["hugo", "buy", "YES", 1n],
    ]);
    for (const outcome of ["YES", "NO"] as const) {
      const market = resolvePayouts(b, outcome).filter((t) => t.reason !== "creator_bonus");
      expect(total(market)).toBe(coinsIn(b));
    }
  });
});

describe("rule 13: the creator gets back at most their seed plus 1% of what the crowd lost", () => {
  it("Mael's example: Tom bets 300 on YES, Sam 20 on NO, NO wins", () => {
    const b = book([
      ["tom", "buy", "YES", 30000n],
      ["sam", "buy", "NO", 2000n],
    ]);
    const sam = b.positions.get("sam")!;
    const leftover = coinsIn(b) - base(sam.no); // what the pool holds for the creator today
    const surplus = leftover - SEED;
    const ts = resolvePayouts(b, "NO");
    expect(to(ts, "creator", "seed_return")).toBe(SEED + surplus / 100n);
    expect(to(ts, "sam", "payout")).toBe(base(sam.no) + surplus - surplus / 100n);
    // About 101.22 for the creator and 318.78 for Sam.
    expect(to(ts, "creator", "seed_return")).toBe(10122n);
    expect(to(ts, "sam", "payout")).toBe(31878n);
  });

  it("when the crowd was right, the creator gets the pool's leftovers, less than the seed", () => {
    const b = book([["lea", "buy", "YES", 50000n]]);
    const lea = b.positions.get("lea")!;
    const ts = resolvePayouts(b, "YES");
    expect(to(ts, "creator", "seed_return")).toBe(coinsIn(b) - base(lea.yes));
    expect(to(ts, "creator", "seed_return")).toBeLessThan(SEED);
  });

  it("several winners split the surplus in proportion to their winning shares", () => {
    const b = book([
      ["lea", "buy", "YES", 3000n],
      ["hugo", "buy", "YES", 1000n],
      ["tom", "buy", "NO", 40000n],
    ]);
    const lea = b.positions.get("lea")!;
    const hugo = b.positions.get("hugo")!;
    const ts = resolvePayouts(b, "YES");
    const leaExtra = to(ts, "lea", "payout") - base(lea.yes);
    const hugoExtra = to(ts, "hugo", "payout") - base(hugo.yes);
    expect(leaExtra).toBeGreaterThan(0n);
    expect(hugoExtra).toBeGreaterThan(0n);
    // Same ratio as their shares, within a hundredth of rounding.
    const expectedLea = D(hugoExtra.toString()).mul(lea.yes).div(hugo.yes);
    expect(D(leaExtra.toString()).minus(expectedLea).abs().lte(2)).toBe(true);
    const leftover = coinsIn(b) - base(lea.yes) - base(hugo.yes);
    const back = to(ts, "creator", "seed_return");
    expect(back).toBeGreaterThanOrEqual(SEED + (leftover - SEED) / 100n);
    expect(back).toBeLessThanOrEqual(SEED + (leftover - SEED) / 100n + 2n); // + rounding dust
  });

  it("if nobody holds a winning share, the surplus goes back to the players in proportion to what they put in", () => {
    const b = book([
      ["tom", "buy", "YES", 30000n],
      ["lea", "buy", "YES", 10000n],
    ]);
    const ts = resolvePayouts(b, "NO");
    const surplus = coinsIn(b) - SEED; // nobody won, so the pool holds every coin
    const toPlayers = surplus - surplus / 100n;
    expect(to(ts, "creator", "seed_return")).toBe(SEED + surplus / 100n);
    expect(to(ts, "tom", "refund")).toBe((toPlayers * 30000n) / 40000n);
    expect(to(ts, "lea", "refund")).toBe((toPlayers * 10000n) / 40000n);
  });

  it("a creator who also bets gets their payout and their seed return as separate lines", () => {
    const b = book([["creator", "buy", "YES", 5000n]]);
    const ts = resolvePayouts(b, "YES");
    expect(to(ts, "creator", "payout")).toBeGreaterThan(0n);
    expect(to(ts, "creator", "seed_return")).toBeGreaterThan(0n);
  });
});

describe("rule 14: the creator bonus is 1% of bets minus sales, paid at resolution", () => {
  it("pays 1% of every player's bets, the creator's own included", () => {
    const b = book([
      ["lea", "buy", "YES", 10000n],
      ["tom", "buy", "NO", 5050n],
      ["creator", "buy", "YES", 2000n],
    ]);
    expect(to(resolvePayouts(b, "YES"), "creator", "creator_bonus")).toBe(170n); // 1% of 170.50, rounded down
  });

  it("buying then selling straight back earns the creator nothing", () => {
    const b = book([
      ["tom", "buy", "YES", 100000n],
      ["tom", "sell", "YES", "all"],
    ]);
    expect(to(resolvePayouts(b, "YES"), "creator", "creator_bonus")).toBe(0n);
  });

  it("no bonus when everyone has sold out: only rounding dust is left in", () => {
    const b = book([
      ["lea", "buy", "YES", 10000n],
      ["tom", "buy", "YES", 40000n],
      ["lea", "sell", "YES", "all"],
      ["tom", "sell", "YES", "all"],
    ]);
    // The pool always keeps at least the seed's worth (√(yes × no) ≥ 100), so
    // bets − sales never goes below zero; here it is a hundredth of dust.
    expect(coinsIn(b) - SEED).toBeLessThan(100n);
    expect(to(resolvePayouts(b, "YES"), "creator", "creator_bonus")).toBe(0n);
  });

  it("a cancelled market pays no bonus", () => {
    const b = book([["tom", "buy", "YES", 30000n]]);
    expect(to(cancelRefunds(b, new Map()), "creator", "creator_bonus")).toBe(0n);
  });
});

describe("rule 9: a cancelled market refunds what everyone put in", () => {
  it("refunds every player their net stake and the creator their seed", () => {
    const b = book([
      ["lea", "buy", "YES", 10000n],
      ["tom", "buy", "NO", 2500n],
    ]);
    const ts = cancelRefunds(b, new Map());
    expect(to(ts, "lea", "refund")).toBe(10000n);
    expect(to(ts, "tom", "refund")).toBe(2500n);
    expect(to(ts, "creator", "seed_return")).toBe(SEED);
    expect(total(ts)).toBe(coinsIn(b));
  });

  it("a player who sold part of a bet gets back only what is still in", () => {
    const b0 = book([["lea", "buy", "YES", 10000n]]);
    const half = b0.positions.get("lea")!.yes.div(2).toDecimalPlaces(12).toString();
    const b = book([
      ["lea", "buy", "YES", 10000n],
      ["lea", "sell", "YES", half],
    ]);
    const lea = b.positions.get("lea")!;
    const ts = cancelRefunds(b, new Map());
    expect(to(ts, "lea", "refund")).toBe(lea.invested);
    expect(to(ts, "creator", "seed_return")).toBe(SEED);
  });
});

describe("rule 9, decided 2026-11-10: take back profit that's there, never below zero", () => {
  // Léa buys YES early, Tom pushes the price up, Léa sells at a profit.
  const profitable = () => {
    const b0 = book([["lea", "buy", "YES", 10000n]]);
    const leaShares = b0.positions.get("lea")!.yes.toDecimalPlaces(12).toString();
    return book([
      ["lea", "buy", "YES", 10000n],
      ["tom", "buy", "YES", 40000n],
      ["lea", "sell", "YES", leaShares],
    ]);
  };

  it("takes Léa's profit back in full when Léa still has it", () => {
    const b = profitable();
    const leaProfit = -b.positions.get("lea")!.invested;
    expect(leaProfit).toBeGreaterThan(0n);
    const ts = cancelRefunds(b, new Map([["lea", 1_000_000n]]));
    expect(to(ts, "lea", "refund")).toBe(-leaProfit);
    expect(to(ts, "tom", "refund")).toBe(40000n);
    expect(to(ts, "creator", "seed_return")).toBe(SEED);
    expect(total(ts)).toBe(coinsIn(b));
  });

  it("takes only what Léa has left, and the creator's seed covers the gap", () => {
    const b = profitable();
    const leaProfit = -b.positions.get("lea")!.invested;
    const leaBalance = 500n;
    const ts = cancelRefunds(b, new Map([["lea", leaBalance]]));
    expect(to(ts, "lea", "refund")).toBe(-leaBalance);
    expect(to(ts, "tom", "refund")).toBe(40000n);
    expect(to(ts, "creator", "seed_return")).toBe(SEED - (leaProfit - leaBalance));
    expect(total(ts)).toBe(coinsIn(b));
  });

  it("never takes anything from a player with no balance", () => {
    const b = profitable();
    const ts = cancelRefunds(b, new Map([["lea", 0n]]));
    expect(to(ts, "lea")).toBe(0n);
    expect(total(ts)).toBe(coinsIn(b));
  });

  it("if the gap is bigger than the seed, the creator gets 0 and other refunds shrink in proportion", () => {
    // One sale can't make more than about the seed in profit; repeated swings can.
    // Léa rides three swings caused by whales, taking profit each time,
    // then spends it all elsewhere (balance 0).
    const b = book([
      ["lea", "buy", "YES", 100000n],
      ["whale1", "buy", "YES", 1000000n],
      ["lea", "sell", "YES", "all"],
      ["whale2", "buy", "NO", 3000000n],
      ["lea", "buy", "YES", 100000n],
      ["whale3", "buy", "YES", 9000000n],
      ["lea", "sell", "YES", "all"],
    ]);
    const owed = -b.positions.get("lea")!.invested;
    expect(owed).toBeGreaterThan(SEED);
    const ts = cancelRefunds(b, new Map([["lea", 0n]]));
    expect(to(ts, "lea")).toBe(0n);
    expect(to(ts, "creator", "seed_return")).toBeLessThan(10n); // only rounding dust
    for (const whale of ["whale1", "whale2", "whale3"]) {
      const invested = b.positions.get(whale)!.invested;
      expect(to(ts, whale, "refund")).toBeLessThan(invested);
      expect(to(ts, whale, "refund")).toBeGreaterThan(0n);
    }
    expect(total(ts)).toBe(coinsIn(b));
    for (const t of ts) {
      if (t.amount < 0n) expect(t.reason).toBe("refund");
    }
  });
});
