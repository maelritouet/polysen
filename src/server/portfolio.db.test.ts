import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { quoteSell } from "@/core/amm";
import { D, decimalToCoinsDown } from "@/core/money";
import { markets } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import { createMarket, cancelMarket } from "./markets";
import { getPortfolio } from "./portfolio";
import { buy, sell } from "./trading";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;
async function member(coins = 100000n) {
  const m = await createRootMember(t.db, t.users);
  await giveCoins(t.db, m.id, coins);
  return m.id;
}
const market = (creator: string) =>
  createMarket(t.db, creator, {
    question: "Le partiel sera-t-il dur ?",
    criteria: "Vote de la promo.",
    closeAt: new Date(Date.now() + 48 * HOUR),
    tagIds: [],
    acceptedRules: true,
  });
const bet = (who: string, marketId: string, side: "YES" | "NO", coins: bigint) =>
  buy(t.db, who, { marketId, side, coins, requestId: randomUUID() });

async function pool(marketId: string) {
  const [m] = await t.db.select().from(markets).where(eq(markets.id, marketId));
  return { yes: D(m.poolYes), no: D(m.poolNo) };
}

describe("the portfolio", () => {
  it("values each open position at what selling it all would pay right now", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea);
    const mine = await bet(tom, m.id, "YES", 20000n);
    await bet(lea, m.id, "NO", 5000n); // the price moves after Tom's bet

    const p = await getPortfolio(t.db, tom);
    expect(p.open).toHaveLength(1);
    const pos = p.open[0];
    expect(pos).toMatchObject({ marketId: m.id, side: "YES", cost: 20000n, question: "Le partiel sera-t-il dur ?" });
    expect(pos.shares.eq(mine.shares)).toBe(true);
    const expected = quoteSell(await pool(m.id), "YES", mine.shares).proceeds;
    expect(pos.value).toBe(expected);
    expect(p.value).toBe(expected);
    expect(p.cost).toBe(20000n);
    expect(p.closed).toHaveLength(0);
  });

  it("keeps the average cost of the shares still held, and drops positions sold in full", async () => {
    const tom = await member();
    const lea = await member();
    const m = await market(lea);
    const b = await bet(tom, m.id, "YES", 20000n);
    const half = b.shares.div(2).toDecimalPlaces(12);
    await sell(t.db, tom, { marketId: m.id, side: "YES", shares: half.toFixed(12), requestId: randomUUID() });

    let p = await getPortfolio(t.db, tom);
    expect(p.open).toHaveLength(1);
    // Half the shares sold takes half the cost with it (rounded down): the rest stays.
    expect(p.open[0].cost).toBe(20000n - decimalToCoinsDown(D(200).mul(half).div(b.shares)));
    expect(p.open[0].shares.eq(b.shares.minus(half))).toBe(true);

    await sell(t.db, tom, { marketId: m.id, side: "YES", shares: "all", requestId: randomUUID() });
    p = await getPortfolio(t.db, tom);
    expect(p.open).toHaveLength(0);
  });

  it("lists YES and NO separately when a member holds both", async () => {
    const tom = await member();
    const lea = await member();
    const m = await market(lea);
    await bet(tom, m.id, "YES", 3000n);
    await bet(tom, m.id, "NO", 1000n);
    const p = await getPortfolio(t.db, tom);
    expect(p.open.map((o) => [o.side, o.cost])).toEqual([
      ["YES", 3000n],
      ["NO", 1000n],
    ]);
    expect(p.cost).toBe(4000n);
  });

  it("moves a cancelled market to finished bets with what went in and came back", async () => {
    const tom = await member();
    const lea = await member();
    const m = await market(lea);
    await bet(tom, m.id, "YES", 20000n);
    await sell(t.db, tom, { marketId: m.id, side: "YES", shares: "1", requestId: randomUUID() });
    await t.db.transaction((tx) => cancelMarket(tx, m.id));

    const p = await getPortfolio(t.db, tom);
    expect(p.open).toHaveLength(0);
    expect(p.closed).toHaveLength(1);
    const c = p.closed[0];
    expect(c).toMatchObject({ marketId: m.id, status: "cancelled", spent: 20000n });
    // A cancel gives back exactly the net stake: sale + refund = what was bet.
    expect(c.received).toBe(20000n);
    expect(c.net).toBe(0n);

    // The creator's seed is not a bet: Léa never traded, so she has no finished bet.
    expect((await getPortfolio(t.db, lea)).closed).toHaveLength(0);
  });

  it("only shows the member's own positions", async () => {
    const tom = await member();
    const lea = await member();
    const m = await market(lea);
    await bet(lea, m.id, "NO", 3000n);
    const p = await getPortfolio(t.db, tom);
    expect(p.open).toHaveLength(0);
    expect(p.value).toBe(0n);
  });
});
