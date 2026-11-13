import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { newPool, quoteBuy, quoteSell, type Pool, type Side } from "./amm";
import { holdings, MIN_PLAYERS, rankableMarkets, realisedGains, standings, type Fill, type Gain } from "./leaderboard";
import { MARKET_SEED } from "./ledger";
import { D, type Coins } from "./money";
import { cancelRefunds, resolvePayouts, type MarketBook, type Position } from "./settlement";

/** A tiny market that records fills the way the server does. */
function game() {
  let pool: Pool = newPool(MARKET_SEED);
  const fills: Fill[] = [];
  const positions = new Map<string, Position>();
  const cash = new Map<string, Coins>(); // sales + payouts + refunds − bets, per player
  let t = 0;
  const add = (who: string, d: Coins) => cash.set(who, (cash.get(who) ?? 0n) + d);
  const pos = (who: string) => positions.get(who) ?? { yes: D(0), no: D(0), invested: 0n };
  return {
    fills,
    cash,
    positions,
    buy(who: string, side: Side, coins: Coins) {
      const q = quoteBuy(pool, side, coins);
      pool = q.pool;
      fills.push({ at: new Date(++t), memberId: who, marketId: "m", side, kind: "buy", coins, shares: q.shares });
      const p = pos(who);
      positions.set(who, { yes: side === "YES" ? p.yes.plus(q.shares) : p.yes, no: side === "NO" ? p.no.plus(q.shares) : p.no, invested: p.invested + coins });
      add(who, -coins);
      return q.shares;
    },
    sell(who: string, side: Side, shares: ReturnType<typeof D>) {
      const q = quoteSell(pool, side, shares);
      pool = q.pool;
      fills.push({ at: new Date(++t), memberId: who, marketId: "m", side, kind: "sell", coins: q.proceeds, shares });
      const p = pos(who);
      positions.set(who, { yes: side === "YES" ? p.yes.minus(shares) : p.yes, no: side === "NO" ? p.no.minus(shares) : p.no, invested: p.invested - q.proceeds });
      add(who, q.proceeds);
      return q.proceeds;
    },
    book(): MarketBook {
      return { pool, seed: MARKET_SEED, creatorId: "creator", positions };
    },
    /** Settles with the core's transfers; returns the Settlement the server would build (payout + refund rows only). */
    settle(how: "YES" | "NO" | "cancel") {
      const rich = new Map([...positions.keys()].map((id) => [id, 10n ** 12n]));
      const transfers = how === "cancel" ? cancelRefunds(this.book(), rich) : resolvePayouts(this.book(), how);
      const paid = new Map<string, Coins>();
      for (const tr of transfers) {
        if (tr.reason !== "payout" && tr.reason !== "refund") continue;
        paid.set(tr.memberId, (paid.get(tr.memberId) ?? 0n) + tr.amount);
        add(tr.memberId, tr.amount);
      }
      return { marketId: "m", at: new Date(++t), paid };
    },
  };
}

const total = (gains: Gain[], who: string) => gains.filter((g) => g.memberId === who).reduce((s, g) => s + g.amount, 0n);

describe("realised gains", () => {
  it("a sale realises what it paid minus the average cost of the shares sold", () => {
    const g = game();
    const a = g.buy("lea", "YES", 10000n);
    const b = g.buy("lea", "YES", 5000n);
    const half = a.plus(b).div(2).toDecimalPlaces(12);
    const proceeds = g.sell("lea", "YES", half);
    const gains = realisedGains(g.fills, []);
    expect(gains).toHaveLength(1);
    expect(gains[0].amount).toBe(proceeds - 7500n); // half of the 150 coins paid
    expect(holdings(g.fills)("lea", "m", "YES").cost).toBe(7500n);
  });

  it("selling everything takes the whole cost, leaving nothing behind", () => {
    const g = game();
    g.buy("lea", "YES", 3333n);
    g.buy("lea", "YES", 1n);
    const s = g.fills.reduce((x, f) => x.plus(f.shares), D(0));
    const proceeds = g.sell("lea", "YES", s);
    expect(realisedGains(g.fills, [])[0].amount).toBe(proceeds - 3334n);
    expect(holdings(g.fills)("lea", "m", "YES")).toEqual({ shares: D(0), cost: 0n });
  });

  it("buying, then selling straight back realises nothing", () => {
    const g = game();
    const s = g.buy("lea", "NO", 4200n);
    g.sell("lea", "NO", s);
    expect(realisedGains(g.fills, []).map((x) => x.amount)).toEqual([0n]);
  });

  it("at settlement, a loser with no payout realises minus what their shares cost", () => {
    const g = game();
    g.buy("lea", "YES", 20000n);
    g.buy("tom", "NO", 5000n);
    const gains = realisedGains(g.fills, [g.settle("NO")]);
    expect(total(gains, "lea")).toBe(-20000n);
    expect(total(gains, "tom")).toBe(g.cash.get("tom"));
    expect(total(gains, "tom")).toBeGreaterThan(0n);
  });

  it("over a settled market, each player's gains add up exactly to their coins out minus coins in", () => {
    const player = fc.constantFrom("lea", "tom", "hugo", "ines");
    const step = fc.oneof(
      fc.record({ buy: fc.constant(true), who: player, side: fc.constantFrom<Side>("YES", "NO"), coins: fc.bigInt({ min: 1n, max: 40_000n }) }),
      fc.record({ buy: fc.constant(false), who: player, side: fc.constantFrom<Side>("YES", "NO"), part: fc.constantFrom(1, 0.5, 0.3, 0.999) }),
    );
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), fc.constantFrom<"YES" | "NO" | "cancel">("YES", "NO", "cancel"), (steps, how) => {
        const g = game();
        for (const s of steps) {
          try {
            if (s.buy) g.buy(s.who, s.side, s.coins);
            else {
              const p = g.positions.get(s.who);
              const held = !p ? D(0) : s.side === "YES" ? p.yes : p.no;
              const n = s.part === 1 ? held : held.mul(s.part).toDecimalPlaces(12, 1);
              if (n.gt(0)) g.sell(s.who, s.side, n);
            }
          } catch {
            // refused by the market maker (too big / too small): nothing happened
          }
        }
        const gains = realisedGains(g.fills, [g.settle(how)]);
        for (const [who, net] of g.cash) expect(total(gains, who)).toBe(net);
        expect(gains.every((x) => x.memberId !== "creator" || g.cash.has("creator"))).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("which markets count", () => {
  const fill = (memberId: string, marketId: string): Fill => ({ at: new Date(0), memberId, marketId, side: "YES", kind: "buy", coins: 100n, shares: D(1) });
  it(`needs at least ${MIN_PLAYERS} different traders`, () => {
    const fills = [fill("lea", "a"), fill("tom", "a"), fill("tom", "a"), fill("lea", "b"), fill("tom", "b"), fill("sam", "b")];
    expect([...rankableMarkets(fills)]).toEqual(["b"]);
  });
});

describe("standings", () => {
  const gain = (memberId: string, amount: bigint, at = 10, marketId = "m"): Gain => ({ memberId, marketId, at: new Date(at), amount });
  const all = new Set(["m"]);

  it("ranks by profit in the window, ties share a rank, everyone listed", () => {
    const rows = standings([gain("lea", 500n), gain("tom", 500n), gain("sam", -100n), gain("lea", 900n, 99)], all, ["lea", "tom", "sam", "ines"], new Date(0), new Date(50));
    expect(rows.map((r) => [r.memberId, r.profit, r.rank])).toEqual([
      ["lea", 500n, 1],
      ["tom", 500n, 1],
      ["ines", 0n, 3],
      ["sam", -100n, 4],
    ]);
  });

  it("ignores markets that don't count and gains outside [from, to)", () => {
    const rows = standings([gain("lea", 500n, 10, "small"), gain("lea", 7n, 50), gain("lea", 3n, 0)], all, ["lea"], new Date(0), new Date(50));
    expect(rows[0].profit).toBe(3n);
  });
});
