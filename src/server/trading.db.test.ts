import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { newPool, quoteBuy, quoteSell, type Pool } from "@/core/amm";
import { MARKET_SEED } from "@/core/ledger";
import { D } from "@/core/money";
import { checkBook } from "@/core/settlement";
import { ledger, trades } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import { loadBook } from "./book";
import { createMarket } from "./markets";
import { buy, quoteBuyFor, quoteSellFor, sell } from "./trading";
import { getBalance } from "./wallet";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;

async function member(coins = 100000n) {
  const m = await createRootMember(t.db, t.users);
  if (coins > 0n) await giveCoins(t.db, m.id, coins);
  return m.id;
}

async function market(creatorId: string, opts: { tagIds?: string[]; closeInHours?: number } = {}) {
  const m = await createMarket(t.db, creatorId, {
    question: "Le partiel de mardi sera-t-il dur ?",
    criteria: "Vote de la promo après l'épreuve.",
    closeAt: new Date(Date.now() + (opts.closeInHours ?? 48) * HOUR),
    tagIds: opts.tagIds ?? [],
    acceptedRules: true,
  });
  return m.id;
}

const req = () => randomUUID();

describe("buying", () => {
  it("11 · gives exactly the shares and new price the core predicts, and takes the coins", async () => {
    const lea = await member();
    const tom = await member(50000n);
    const m = await market(lea);

    const expected = quoteBuy(newPool(MARKET_SEED), "YES", 10000n);
    const preview = await quoteBuyFor(t.db, m, "YES", 10000n);
    expect(preview.shares.eq(expected.shares)).toBe(true);

    const r = await buy(t.db, tom, { marketId: m, side: "YES", coins: 10000n, requestId: req() });
    expect(r.shares.eq(expected.shares)).toBe(true);
    expect(await getBalance(t.db, tom)).toBe(40000n);
    const book = (await loadBook(t.db, m))!;
    expect(book.pool.yes.eq(expected.pool.yes) && book.pool.no.eq(expected.pool.no)).toBe(true);
    expect(book.positions.get(tom)!.yes.eq(expected.shares)).toBe(true);
    // The confirm sheet: 100 YES on a 100/100 pool leaves 50 YES / 200 NO, so 80%.
    // A win pays at least 1 coin per share.
    expect(preview.percentAfter).toBe(80);
    expect(preview.payoutAtLeast).toBe(BigInt(expected.shares.mul(100).floor().toFixed(0)));
  });

  it("12 · refuses a bet bigger than the balance, and changes nothing", async () => {
    const lea = await member();
    const tom = await member(5000n);
    const m = await market(lea);
    await expect(buy(t.db, tom, { marketId: m, side: "YES", coins: 5001n, requestId: req() })).rejects.toThrow(/pièces/);
    expect(await getBalance(t.db, tom)).toBe(5000n);
    expect((await loadBook(t.db, m))!.positions.size).toBe(0);
  });

  it("13 · refuses a bet under 1 coin", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea);
    await expect(buy(t.db, tom, { marketId: m, side: "YES", coins: 50n, requestId: req() })).rejects.toThrow(/1 pièce/);
  });

  it("14 · refuses a bet after the close date, and on a market waiting for approval", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea, { closeInHours: 2 });
    const later = new Date(Date.now() + 3 * HOUR);
    await expect(buy(t.db, tom, { marketId: m, side: "YES", coins: 1000n, requestId: req() }, later)).rejects.toThrow(/fermé/);
    const pending = await market(lea, { tagIds: [tom] });
    await expect(buy(t.db, tom, { marketId: pending, side: "YES", coins: 1000n, requestId: req() })).rejects.toThrow(/ouvert/);
  });

  it("15 · pays no creator bonus on a bet: it comes at resolution (decision 007)", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea);
    const before = await getBalance(t.db, lea);
    await buy(t.db, tom, { marketId: m, side: "YES", coins: 5000n, requestId: req() });
    expect(await getBalance(t.db, lea)).toBe(before);
  });
});

describe("selling", () => {
  it("16 · selling half then everything pays what the core predicts and leaves 0 shares", async () => {
    const lea = await member();
    const tom = await member(50000n);
    const m = await market(lea);
    await buy(t.db, tom, { marketId: m, side: "NO", coins: 20000n, requestId: req() });

    let book = (await loadBook(t.db, m))!;
    const held = book.positions.get(tom)!.no;
    const half = held.div(2).toDecimalPlaces(12);
    const q1 = quoteSell(book.pool, "NO", half);
    expect((await quoteSellFor(t.db, m, tom, "NO", half.toString())).proceeds).toBe(q1.proceeds);
    const s1 = await sell(t.db, tom, { marketId: m, side: "NO", shares: half.toString(), requestId: req() });
    expect(s1.coins).toBe(q1.proceeds);

    book = (await loadBook(t.db, m))!;
    const q2 = quoteSell(book.pool, "NO", book.positions.get(tom)!.no);
    const s2 = await sell(t.db, tom, { marketId: m, side: "NO", shares: "all", requestId: req() });
    expect(s2.coins).toBe(q2.proceeds);

    book = (await loadBook(t.db, m))!;
    expect(book.positions.get(tom)!.no.isZero()).toBe(true);
    expect(await getBalance(t.db, tom)).toBe(30000n + q1.proceeds + q2.proceeds);
  });

  it("refuses selling more than you hold, or shares you don't have", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea);
    await expect(sell(t.db, tom, { marketId: m, side: "YES", shares: "all", requestId: req() })).rejects.toThrow(/parts/);
    await buy(t.db, tom, { marketId: m, side: "YES", coins: 1000n, requestId: req() });
    const held = (await loadBook(t.db, m))!.positions.get(tom)!.yes;
    await expect(
      sell(t.db, tom, { marketId: m, side: "YES", shares: held.plus("0.000000000001").toString(), requestId: req() }),
    ).rejects.toThrow(/parts/);
    await expect(sell(t.db, tom, { marketId: m, side: "YES", shares: "abc", requestId: req() })).rejects.toThrow();
  });

  it("refuses a sale after the close date", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea, { closeInHours: 2 });
    await buy(t.db, tom, { marketId: m, side: "YES", coins: 1000n, requestId: req() });
    const later = new Date(Date.now() + 3 * HOUR);
    await expect(sell(t.db, tom, { marketId: m, side: "YES", shares: "all", requestId: req() }, later)).rejects.toThrow(/fermé/);
  });
});

describe("17 · a replayed request does nothing new", () => {
  it("the same request_id twice writes one trade and returns the same result", async () => {
    const lea = await member();
    const tom = await member(50000n);
    const m = await market(lea);
    const requestId = req();
    const a = await buy(t.db, tom, { marketId: m, side: "YES", coins: 3000n, requestId });
    const b = await buy(t.db, tom, { marketId: m, side: "YES", coins: 3000n, requestId });
    expect(b.shares.eq(a.shares)).toBe(true);
    expect(await getBalance(t.db, tom)).toBe(47000n);
    expect(await t.db.select().from(trades).where(eq(trades.requestId, requestId))).toHaveLength(1);
  });

  it("even when both copies arrive at the same moment", async () => {
    const lea = await member();
    const tom = await member(50000n);
    const m = await market(lea);
    const requestId = req();
    const results = await Promise.all(
      [1, 2, 3].map(() => buy(t.db, tom, { marketId: m, side: "NO", coins: 2000n, requestId })),
    );
    expect(results.every((r) => r.shares.eq(results[0].shares))).toBe(true);
    expect(await getBalance(t.db, tom)).toBe(48000n);
  });

  it("refuses reusing someone else's request_id", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await market(lea);
    const requestId = req();
    await buy(t.db, tom, { marketId: m, side: "YES", coins: 1000n, requestId });
    await expect(buy(t.db, sam, { marketId: m, side: "YES", coins: 1000n, requestId })).rejects.toThrow();
    expect(await getBalance(t.db, sam)).toBe(100000n);
  });
});

describe("18 · bets at the same moment", () => {
  it("run one after the other: the final pool equals the core applied in the order they were written", async () => {
    const lea = await member();
    const players = await Promise.all([1, 2, 3, 4, 5, 6].map(() => member(100000n)));
    const m = await market(lea);
    await Promise.all(
      players.map((p, i) =>
        buy(t.db, p, { marketId: m, side: i % 2 ? "YES" : "NO", coins: BigInt(1000 * (i + 1)), requestId: req() }),
      ),
    );

    const rows = await t.db.select().from(trades).where(eq(trades.marketId, m)).orderBy(asc(trades.id));
    expect(rows).toHaveLength(6);
    let pool: Pool = newPool(MARKET_SEED);
    for (const r of rows) {
      const q = quoteBuy(pool, r.side, r.coins);
      expect(D(r.shares).eq(q.shares)).toBe(true);
      expect(D(r.probBefore).eq(q.probBefore.toDecimalPlaces(12))).toBe(true);
      pool = q.pool;
    }
    const book = (await loadBook(t.db, m))!;
    expect(book.pool.yes.eq(pool.yes) && book.pool.no.eq(pool.no)).toBe(true);
    expect(() => checkBook(book)).not.toThrow();
  });

  it("one player's parallel bets can't spend more than their balance", async () => {
    const lea = await member();
    const tom = await member(10000n);
    const m = await market(lea);
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map(() => buy(t.db, tom, { marketId: m, side: "YES", coins: 4000n, requestId: req() })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await getBalance(t.db, tom)).toBe(2000n);
  });
});

describe("DB prices equal the core's, over a random session", () => {
  it("80 random buys and sells by 4 players: every trade and the final pool match a core replay", async () => {
    const lea = await member();
    const players = await Promise.all([1, 2, 3, 4].map(() => member(500000n)));
    const m = await market(lea);
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    for (let i = 0; i < 80; i++) {
      const p = players[rand(4)];
      const side = rand(2) ? "YES" : "NO";
      try {
        if (rand(3)) {
          await buy(t.db, p, { marketId: m, side, coins: BigInt(100 + rand(30000)), requestId: req() });
        } else {
          const held = (await loadBook(t.db, m))!.positions.get(p);
          const h = side === "YES" ? held?.yes : held?.no;
          if (!h || h.isZero()) continue;
          const shares = rand(2) ? "all" : h.mul(rand(90) + 5).div(100).toDecimalPlaces(12).toString();
          await sell(t.db, p, { marketId: m, side, shares, requestId: req() });
        }
      } catch (err) {
        if (!(err instanceof Error) || !("isUserError" in err)) throw err;
      }
    }

    const rows = await t.db.select().from(trades).where(eq(trades.marketId, m)).orderBy(asc(trades.id));
    expect(rows.length).toBeGreaterThan(40);
    let pool: Pool = newPool(MARKET_SEED);
    for (const r of rows) {
      if (r.kind === "buy") {
        const q = quoteBuy(pool, r.side, r.coins);
        expect(D(r.shares).eq(q.shares)).toBe(true);
        pool = q.pool;
      } else {
        const q = quoteSell(pool, r.side, D(r.shares));
        expect(r.coins).toBe(q.proceeds);
        pool = q.pool;
      }
    }
    const book = (await loadBook(t.db, m))!;
    expect(book.pool.yes.eq(pool.yes) && book.pool.no.eq(pool.no)).toBe(true);
    expect(() => checkBook(book)).not.toThrow();

    // Ledger agrees with trades: bets and sales on this market match coins traded.
    const ledgerRows = await t.db.select().from(ledger).where(eq(ledger.marketId, m));
    const traded = rows.reduce((s, r) => s + (r.kind === "buy" ? -r.coins : r.coins), 0n);
    const fromLedger = ledgerRows.filter((r) => r.reason !== "seed").reduce((s, r) => s + r.amount, 0n);
    expect(fromLedger).toBe(traded);
  }, 60_000);
});
