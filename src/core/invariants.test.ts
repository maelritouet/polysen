import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { newPool, quoteBuy, quoteSell, type Side } from "./amm";
import { MARKET_SEED, STARTING_GRANT } from "./ledger";
import { coinsToDecimal, D } from "./money";
import { checkBook, coinsIn } from "./settlement";
import { Simulation } from "./simulate";

/**
 * The two invariants from the build plan, checked over 10,000 random
 * sequences of actions, after every single step:
 *
 *   rule 11: no member's balance ever goes below zero;
 *   rule 12: no coin is ever created or lost. Every coin that exists came
 *            from a grant, a drop or a bonus, and is either in a wallet or
 *            inside an open market. A settled market nets to exactly zero.
 */

const PLAYERS = ["lea", "tom", "hugo", "ines"];

const arbSide = fc.constantFrom<Side>("YES", "NO");
/** Mostly small bets, sometimes tiny (0.01), sometimes huge. */
const arbAmount = fc.oneof(
  fc.bigInt({ min: 1n, max: 100n }),
  fc.bigInt({ min: 100n, max: 50_000n }),
  fc.bigInt({ min: 50_000n, max: 500_000n }),
);

const arbAction = fc.oneof(
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("create" as const), player: fc.nat(3) }) },
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant("buy" as const),
      player: fc.nat(3),
      market: fc.nat(4),
      side: arbSide,
      amount: arbAmount,
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("sell" as const),
      player: fc.nat(3),
      market: fc.nat(4),
      // Fraction of the position to sell: 1 = all of it. 1.5 tries to sell
      // more than is held, which must be refused.
      fraction: fc.constantFrom(1, 0.5, 0.1, 0.999, 1.5),
    }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("drop" as const), player: fc.nat(3) }) },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant("resolve" as const), market: fc.nat(4), outcome: arbSide }),
  },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("cancel" as const), market: fc.nat(4) }) },
);

type Action = typeof arbAction extends fc.Arbitrary<infer A> ? A : never;

/** 10 to 60 actions. size "max" stops fast-check from favouring very short sequences. */
const arbSequence = fc.array(arbAction, { minLength: 10, maxLength: 60, size: "max" });

/**
 * Starting balance for a game. Most games use the real 1,000 coins; some give
 * players only 150 or 110 (just enough to open the first market), so they run
 * dry and hit the edge cases (a cancel taking back profit that was already
 * spent, bets refused for lack of coins).
 */
const arbGrant = fc.constantFrom(STARTING_GRANT, STARTING_GRANT, 15000n, 11000n);

/** Every game starts with one open market, so the first actions can already trade. */
function startGame(grant: bigint = STARTING_GRANT): Simulation {
  const sim = new Simulation(PLAYERS, grant);
  sim.createMarket(PLAYERS[0]);
  return sim;
}

/** Applies one action. Returns true if it happened, false if it was refused. */
function apply(sim: Simulation, a: Action): boolean {
  // Actions target open markets; trading on settled markets is tested separately below.
  const ids = sim.openMarketIds();
  const marketAt = (i: number) => (ids.length ? ids[i % ids.length] : undefined);
  try {
    switch (a.kind) {
      case "create":
        sim.createMarket(PLAYERS[a.player]);
        break;
      case "buy": {
        const m = marketAt(a.market);
        if (!m) return false;
        sim.buy(PLAYERS[a.player], m, a.side, a.amount);
        break;
      }
      case "sell": {
        // Pick among the positions this player actually holds.
        const player = PLAYERS[a.player];
        const holdings = ids.flatMap((id) =>
          (["YES", "NO"] as const)
            .filter((side) => sim.sharesHeld(player, id, side).gt(0))
            .map((side) => ({ id, side })),
        );
        if (!holdings.length) return false;
        const { id, side } = holdings[a.market % holdings.length];
        const held = sim.sharesHeld(player, id, side);
        const shares = a.fraction === 1 ? held : held.mul(a.fraction).toDecimalPlaces(12);
        if (!shares.gt(0)) return false;
        sim.sell(player, id, side, shares);
        break;
      }
      case "drop":
        sim.claimDrop(PLAYERS[a.player]);
        break;
      case "resolve": {
        const m = marketAt(a.market);
        if (!m) return false;
        sim.resolve(m, a.outcome);
        break;
      }
      case "cancel": {
        const m = marketAt(a.market);
        if (!m) return false;
        sim.cancel(m);
        break;
      }
    }
  } catch (err) {
    // A refused action is fine (not enough coins, market closed, sale too
    // small...) as long as it changed nothing. The invariants below check that.
    if (!(err instanceof Error)) throw err;
    return false;
  }
  return true;
}

function checkInvariants(sim: Simulation): void {
  // Rule 11: no negative balance, ever.
  for (const p of PLAYERS) {
    expect(sim.balance(p)).toBeGreaterThanOrEqual(0n);
  }

  // Rule 12, globally: minted = in wallets + inside open markets.
  let inWallets = 0n;
  for (const p of PLAYERS) inWallets += sim.balance(p);
  let inMarkets = 0n;
  for (const id of sim.openMarketIds()) {
    const book = sim.book(id);
    checkBook(book); // shares match coins, exactly
    inMarkets += coinsIn(book);
  }
  expect(inWallets + inMarkets).toBe(sim.totalMinted());

  // Rule 12, per market: a settled market's own rows net to exactly zero.
  for (const id of sim.settledMarketIds()) {
    expect(sim.marketNet(id)).toBe(0n);
  }

  // Rule 8: every resolution paid each winner exactly their shares, rounded
  // down to the hundredth, and the creator's seed return was never negative.
  for (const r of sim.resolutions()) {
    for (const [memberId, p] of r.before.positions) {
      const shares = r.outcome === "YES" ? p.yes : p.no;
      const paid = r.transfers
        .filter((t) => t.memberId === memberId && t.reason === "payout")
        .reduce((s, t) => s + t.amount, 0n);
      expect(paid).toBe(BigInt(shares.mul(100).floor().toFixed(0)));
    }
    const back = r.transfers.find((t) => t.reason === "seed_return");
    expect(back && back.amount >= 0n).toBe(true);
  }
}

describe("the two invariants, over 10,000 random sequences", () => {
  it("rule 11 (no negative balance) and rule 12 (no coin created or lost) hold after every step", () => {
    fc.assert(
      fc.property(arbGrant, arbSequence, (grant, actions) => {
        const sim = startGame(grant);
        checkInvariants(sim);
        for (const a of actions) {
          apply(sim, a);
          checkInvariants(sim);
        }
      }),
      { numRuns: 10_000 },
    );
  }, 300_000);
});

describe("the random sequences really exercise the game", () => {
  it("every kind of action succeeds often, so the invariants are tested on real play", () => {
    const happened: Record<string, number> = {};
    fc.assert(
      fc.property(arbSequence, (actions) => {
        const sim = startGame();
        for (const a of actions) if (apply(sim, a)) happened[a.kind] = (happened[a.kind] ?? 0) + 1;
      }),
      { numRuns: 1_000, seed: 42 },
    );
    // Measured on 2026-11-10: ~5,400 buys, ~1,600 sells, ~2,500 creates, ~1,300
    // resolves and cancels. Floors at about half, so a weakened generator fails.
    const floors = { buy: 2500, sell: 750, create: 1200, drop: 800, resolve: 600, cancel: 600 };
    for (const [kind, floor] of Object.entries(floors)) {
      expect(happened[kind] ?? 0, kind).toBeGreaterThan(floor);
    }
  });
});

describe("the simulation refuses bad actions and changes nothing", () => {
  it("refuses a bet bigger than the balance", () => {
    const sim = new Simulation(["lea", "tom"]);
    const m = sim.createMarket("lea");
    const before = sim.balance("tom");
    expect(() => sim.buy("tom", m, "YES", STARTING_GRANT + 1n)).toThrow();
    expect(sim.balance("tom")).toBe(before);
  });

  it("refuses selling shares you don't hold", () => {
    const sim = new Simulation(["lea", "tom"]);
    const m = sim.createMarket("lea");
    expect(() => sim.sell("tom", m, "YES", D(1))).toThrow();
  });

  it("refuses selling more shares than you hold, and changes nothing", () => {
    const sim = new Simulation(["lea", "tom"]);
    const m = sim.createMarket("lea");
    sim.buy("tom", m, "YES", 1000n);
    const held = sim.sharesHeld("tom", m, "YES");
    const before = sim.balance("tom");
    expect(() => sim.sell("tom", m, "YES", held.plus("0.000000000001"))).toThrow("don't hold");
    expect(sim.balance("tom")).toBe(before);
    expect(sim.sharesHeld("tom", m, "YES").eq(held)).toBe(true);
  });

  it("refuses trading on a settled market", () => {
    const sim = new Simulation(["lea", "tom"]);
    const m = sim.createMarket("lea");
    sim.resolve(m, "YES");
    expect(() => sim.buy("tom", m, "YES", 100n)).toThrow();
    expect(() => sim.resolve(m, "NO")).toThrow();
    expect(() => sim.cancel(m)).toThrow();
  });

  it("refuses a second drop on the same day", () => {
    const sim = new Simulation(["lea"]);
    sim.claimDrop("lea");
    expect(() => sim.claimDrop("lea")).toThrow();
  });

  it("refuses creating a market without 100 coins", () => {
    const sim = new Simulation(["lea"]);
    sim.buy("lea", sim.createMarket("lea"), "YES", STARTING_GRANT - MARKET_SEED);
    expect(sim.balance("lea")).toBe(0n);
    expect(() => sim.createMarket("lea")).toThrow();
  });
});

describe("rule 7: trading never creates coins", () => {
  it("players together can never take more out of a market than the creator's seed", () => {
    fc.assert(
      fc.property(arbSequence, (actions) => {
        const sim = startGame();
        for (const a of actions) apply(sim, a);
        for (const id of [...sim.openMarketIds(), ...sim.settledMarketIds()]) {
          // What players (in their trading role) got out minus what they put in.
          expect(sim.playersNetFromMarket(id)).toBeLessThanOrEqual(MARKET_SEED);
        }
      }),
      { numRuns: 2_000 },
    );
  }, 300_000);
});

describe("rule 10: tiny trades can't farm rounding", () => {
  it("many small buys never get more shares than one buy of the same total", () => {
    fc.assert(
      fc.property(arbSide, fc.array(fc.bigInt({ min: 1n, max: 300n }), { minLength: 2, maxLength: 200 }), (side, bets) => {
        let pool = newPool(MARKET_SEED);
        let small = D(0);
        for (const b of bets) {
          const q = quoteBuy(pool, side, b);
          pool = q.pool;
          small = small.plus(q.shares);
        }
        const total = bets.reduce((s, b) => s + b, 0n);
        const one = quoteBuy(newPool(MARKET_SEED), side, total).shares;
        expect(small.lte(one)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("a thousand 0.01 buys then selling everything back never returns more than was paid", () => {
    let pool = newPool(MARKET_SEED);
    let shares = D(0);
    for (let i = 0; i < 1000; i++) {
      const q = quoteBuy(pool, "YES", 1n);
      pool = q.pool;
      shares = shares.plus(q.shares);
    }
    const back = quoteSell(pool, "YES", shares).proceeds;
    expect(back).toBeLessThanOrEqual(1000n);
    expect(coinsToDecimal(back).gte(9)).toBe(true); // and you do get (almost) all of it back
  });
});
