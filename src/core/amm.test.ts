import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  displayPercent,
  newPool,
  probability,
  quoteBuy,
  quoteSell,
  type Pool,
  type Side,
} from "./amm";
import { D } from "./money";

const SEED = 10000n; // 100 coins, in hundredths

const arbSide = fc.constantFrom<Side>("YES", "NO");
/** 0.01 to 100,000 coins. */
const arbAmount = fc.bigInt({ min: 1n, max: 10_000_000n });

/**
 * A random pool that can really exist: every market starts from a 100-coin
 * seed, then trades move it. Up to 10 bets of up to 5,000 coins each push the
 * price anywhere from about 0.01% to 99.99%.
 */
const arbPool = fc
  .array(fc.tuple(arbSide, fc.bigInt({ min: 1n, max: 500_000n })), { maxLength: 10 })
  .map((bets): Pool => bets.reduce((pool, [side, amount]) => quoteBuy(pool, side, amount).pool, newPool(SEED)));

describe("a new market", () => {
  it("opens at 50%", () => {
    expect(probability(newPool(SEED)).toNumber()).toBe(0.5);
  });
});

describe("rule 1: buying moves the price", () => {
  it("buying YES raises the YES price", () => {
    fc.assert(
      fc.property(arbPool, arbAmount, (pool, amount) => {
        const { probAfter, probBefore } = quoteBuy(pool, "YES", amount);
        expect(probAfter.gt(probBefore)).toBe(true);
      }),
    );
  });

  it("buying NO lowers the YES price", () => {
    fc.assert(
      fc.property(arbPool, arbAmount, (pool, amount) => {
        const { probAfter, probBefore } = quoteBuy(pool, "NO", amount);
        expect(probAfter.lt(probBefore)).toBe(true);
      }),
    );
  });
});

describe("rule 2: the price stays between 0% and 100%", () => {
  it("after any buy", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, (pool, side, amount) => {
        const p = quoteBuy(pool, side, amount).probAfter;
        expect(p.gt(0) && p.lt(1)).toBe(true);
      }),
    );
  });

  it("is shown clamped to 1%..99%", () => {
    expect(displayPercent({ yes: D(1), no: D(100000) })).toBe(99);
    expect(displayPercent({ yes: D(100000), no: D(1) })).toBe(1);
    expect(displayPercent(newPool(SEED))).toBe(50);
  });
});

describe("rule 3: buy then sell straight back returns exactly the coins paid", () => {
  it("on any pool, any side, any amount", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, (pool, side, amount) => {
        const bought = quoteBuy(pool, side, amount);
        const sold = quoteSell(bought.pool, side, bought.shares);
        expect(sold.proceeds).toBe(amount);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("rule 4: no trade takes more than the pool holds", () => {
  it("a sale never pays more than the pool's shares on the other side, and the pool stays positive", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, arbAmount, (pool, side, amount, extra) => {
        // Someone else trades first so the pool is not symmetric.
        const p1 = quoteBuy(pool, side === "YES" ? "NO" : "YES", extra).pool;
        const bought = quoteBuy(p1, side, amount);
        const sold = quoteSell(bought.pool, side, bought.shares);
        const other = side === "YES" ? bought.pool.no : bought.pool.yes;
        expect(D(sold.proceeds.toString()).div(100).lte(other)).toBe(true);
        expect(sold.pool.yes.gt(0) && sold.pool.no.gt(0)).toBe(true);
      }),
    );
  });

  it("a buy never hands out more shares than the pool holds after minting", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, (pool, side, amount) => {
        const { shares, pool: after } = quoteBuy(pool, side, amount);
        const held = side === "YES" ? pool.yes : pool.no;
        expect(shares.lt(held.plus(D(amount.toString()).div(100)))).toBe(true);
        expect(after.yes.gt(0) && after.no.gt(0)).toBe(true);
      }),
    );
  });

  it("refuses to sell zero, negative or dust-sized amounts", () => {
    const pool = newPool(SEED);
    expect(() => quoteSell(pool, "YES", D(0))).toThrow();
    expect(() => quoteSell(pool, "YES", D(-1))).toThrow();
    expect(() => quoteSell(pool, "YES", D("0.000001"))).toThrow();
    expect(() => quoteBuy(pool, "YES", 0n)).toThrow();
    expect(() => quoteBuy(pool, "YES", -100n)).toThrow();
  });
});

describe("rule 5: YES and NO move the price symmetrically", () => {
  it("from 50%, betting X on YES leaves the exact mirror pool of betting X on NO", () => {
    fc.assert(
      fc.property(arbAmount, (amount) => {
        const yes = quoteBuy(newPool(SEED), "YES", amount);
        const no = quoteBuy(newPool(SEED), "NO", amount);
        expect(yes.pool.yes.eq(no.pool.no)).toBe(true);
        expect(yes.pool.no.eq(no.pool.yes)).toBe(true);
        expect(yes.shares.eq(no.shares)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it("so the price moves up exactly as much as it moves down (to 50 decimal places)", () => {
    // Each price is a division rounded at 60 significant digits, so the two
    // sides can differ in the 60th digit (measured: at most 1e-60). Far below
    // anything that could ever show up in coins.
    fc.assert(
      fc.property(arbAmount, (amount) => {
        const up = quoteBuy(newPool(SEED), "YES", amount).probAfter.minus(0.5);
        const down = D(0.5).minus(quoteBuy(newPool(SEED), "NO", amount).probAfter);
        expect(up.minus(down).abs().lt("1e-50")).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("rule 6: a bigger bet gets more shares at a worse average price", () => {
  it("for any pool and side", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, arbAmount, (pool, side, a, b) => {
        fc.pre(a !== b);
        const [small, big] = a < b ? [a, b] : [b, a];
        const s = quoteBuy(pool, side, small).shares;
        const g = quoteBuy(pool, side, big).shares;
        expect(g.gt(s)).toBe(true);
        const avgSmall = D(small.toString()).div(s);
        const avgBig = D(big.toString()).div(g);
        expect(avgBig.gte(avgSmall)).toBe(true);
      }),
    );
  });
});

describe("rule 10 (pool side): rounding always favours the pool", () => {
  const product = (p: Pool) => p.yes.mul(p.no);

  it("a buy never lowers the pool's product yes × no", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, (pool, side, amount) => {
        expect(product(quoteBuy(pool, side, amount).pool).gte(product(pool))).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it("a sale lowers the product by at most the sale tolerance (one millionth of a coin)", () => {
    fc.assert(
      fc.property(arbPool, arbSide, fc.bigInt({ min: 100n, max: 10_000_000n }), (pool, side, amount) => {
        const bought = quoteBuy(pool, side, amount);
        const sold = quoteSell(bought.pool, side, bought.shares);
        // Allowing the pool to pay up to 1e-6 extra coins changes the product by
        // at most 1e-6 × (yes + no). Anything more is a leak.
        const allowed = D("0.000001").mul(sold.pool.yes.plus(sold.pool.no));
        expect(product(sold.pool).gte(product(bought.pool).minus(allowed))).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("conservation inside one trade", () => {
  it("a buy of M coins adds exactly M shares on each side, counting the buyer's", () => {
    fc.assert(
      fc.property(arbPool, arbSide, arbAmount, (pool, side, amount) => {
        const m = D(amount.toString()).div(100);
        const { shares, pool: after } = quoteBuy(pool, side, amount);
        const buyerYes = side === "YES" ? shares : D(0);
        const buyerNo = side === "NO" ? shares : D(0);
        expect(after.yes.plus(buyerYes).eq(pool.yes.plus(m))).toBe(true);
        expect(after.no.plus(buyerNo).eq(pool.no.plus(m))).toBe(true);
      }),
    );
  });

  it("a sale paying R coins removes exactly R shares on each side, counting the seller's", () => {
    fc.assert(
      // At least 1 coin, so half the shares are worth more than a hundredth.
      fc.property(arbPool, arbSide, fc.bigInt({ min: 100n, max: 10_000_000n }), (pool, side, amount) => {
        const bought = quoteBuy(pool, side, amount);
        const half = bought.shares.div(2).toDecimalPlaces(12);
        const sold = quoteSell(bought.pool, side, half);
        const r = D(sold.proceeds.toString()).div(100);
        const sellerYes = side === "YES" ? half : D(0);
        const sellerNo = side === "NO" ? half : D(0);
        expect(sold.pool.yes.minus(sellerYes).eq(bought.pool.yes.minus(r))).toBe(true);
        expect(sold.pool.no.minus(sellerNo).eq(bought.pool.no.minus(r))).toBe(true);
      }),
    );
  });
});
