import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { newPool, quoteBuy, type Pool } from "@/core/amm";
import { MARKET_SEED } from "@/core/ledger";
import { checkBook, coinsIn } from "@/core/settlement";
import { ledger, markets, trades } from "@/db/schema";
import { loadBook } from "@/server/book";
import { cleanup, createRootMember, insertTestBuy, insertTestMarket, openTestDb } from "@/test/db";

/**
 * The phase 3 tables: pools and shares are stored exactly, the positions view
 * sums trades the way the core does, and the constraints refuse bad rows.
 */

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const trade = (marketId: string, memberId: string, over: Partial<typeof trades.$inferInsert> = {}) => ({
  marketId,
  memberId,
  side: "YES" as const,
  kind: "buy" as const,
  coins: 100n,
  shares: "1",
  probBefore: "0.5",
  probAfter: "0.5",
  requestId: randomUUID(),
  ...over,
});

describe("storing a market's book", () => {
  it("keeps pools and shares exactly: the DB book equals the core's replay, and checkBook holds", async () => {
    const lea = await createRootMember(t.db, t.users);
    const tom = await createRootMember(t.db, t.users);
    const m = await insertTestMarket(t.db, lea.id);

    const bets = [
      [tom.id, "YES", 12345n],
      [lea.id, "NO", 777n],
      [tom.id, "NO", 1n],
      [tom.id, "YES", 250000n],
    ] as const;
    let pool: Pool = newPool(MARKET_SEED);
    for (const [who, side, coins] of bets) {
      await insertTestBuy(t.db, m, who, side, coins);
      pool = quoteBuy(pool, side, coins).pool;
    }

    const book = (await loadBook(t.db, m))!;
    expect(book.pool.yes.eq(pool.yes)).toBe(true);
    expect(book.pool.no.eq(pool.no)).toBe(true);
    expect(() => checkBook(book)).not.toThrow();
    expect(coinsIn(book)).toBe(MARKET_SEED + 12345n + 777n + 1n + 250000n);
    expect(book.positions.get(tom.id)!.invested).toBe(12345n + 1n + 250000n);
  });

  it("the positions view subtracts sales from shares and from coins invested", async () => {
    const lea = await createRootMember(t.db, t.users);
    const m = await insertTestMarket(t.db, lea.id);
    await t.db.insert(trades).values(trade(m, lea.id, { shares: "10.5", coins: 1000n }));
    await t.db.insert(trades).values(trade(m, lea.id, { kind: "sell", shares: "4.25", coins: 300n }));
    await t.db.insert(trades).values(trade(m, lea.id, { side: "NO", shares: "2", coins: 150n }));

    const p = (await loadBook(t.db, m))!.positions.get(lea.id)!;
    expect(p.yes.toString()).toBe("6.25");
    expect(p.no.toString()).toBe("2");
    expect(p.invested).toBe(850n);
  });

  it("returns null for a market that doesn't exist", async () => {
    expect(await loadBook(t.db, randomUUID())).toBeNull();
  });
});

describe("the constraints refuse bad rows", () => {
  it("a trade of zero coins or zero shares", async () => {
    const lea = await createRootMember(t.db, t.users);
    const m = await insertTestMarket(t.db, lea.id);
    await expect(t.db.insert(trades).values(trade(m, lea.id, { coins: 0n }))).rejects.toThrow();
    await expect(t.db.insert(trades).values(trade(m, lea.id, { shares: "0" }))).rejects.toThrow();
  });

  it("the same request_id twice", async () => {
    const lea = await createRootMember(t.db, t.users);
    const m = await insertTestMarket(t.db, lea.id);
    const requestId = randomUUID();
    await t.db.insert(trades).values(trade(m, lea.id, { requestId }));
    await expect(t.db.insert(trades).values(trade(m, lea.id, { requestId }))).rejects.toThrow();
  });

  it("a market that closes before it was created, or with a too-short question", async () => {
    const lea = await createRootMember(t.db, t.users);
    await expect(insertTestMarket(t.db, lea.id, new Date(Date.now() - 1000))).rejects.toThrow();
    const id = await insertTestMarket(t.db, lea.id);
    await expect(t.db.update(markets).set({ question: "Hm" }).where(eq(markets.id, id))).rejects.toThrow();
  });

  it("a ledger row pointing at a market that doesn't exist", async () => {
    const lea = await createRootMember(t.db, t.users);
    await expect(
      t.db.insert(ledger).values({ memberId: lea.id, amount: -100n, reason: "bet", marketId: randomUUID() }),
    ).rejects.toThrow();
  });
});
