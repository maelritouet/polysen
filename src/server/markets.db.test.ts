import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { MARKET_SEED } from "@/core/ledger";
import { ledger, marketTags, profiles } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, insertTestBuy, openTestDb } from "@/test/db";
import {
  createMarket,
  getVisibleMarket,
  listVisibleMarkets,
  removeMyMarket,
  respondToTag,
  type NewMarket,
} from "./markets";
import { getBalance } from "./wallet";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;
// A fixed moment: 10:00 in Paris on a winter day.
const NOW = new Date("2026-12-01T09:00:00Z");

const input = (over: Partial<NewMarket> = {}): NewMarket => ({
  question: "Tom viendra-t-il au run de vendredi ?",
  criteria: "Photo du run avec Tom dessus.",
  closeAt: new Date(NOW.getTime() + 48 * HOUR),
  tagIds: [],
  acceptedRules: true,
  ...over,
});

async function member(coins = 15000n) {
  const m = await createRootMember(t.db, t.users);
  if (coins > 0n) await giveCoins(t.db, m.id, coins);
  return m.id;
}

describe("creating a market", () => {
  it("1 · costs 100 coins and opens at 50% when nobody is tagged", async () => {
    const lea = await member(15000n);
    const m = await createMarket(t.db, lea, input(), NOW);
    expect(m.status).toBe("open");
    expect(await getBalance(t.db, lea)).toBe(5000n);
    const seed = await t.db.select().from(ledger).where(and(eq(ledger.memberId, lea), eq(ledger.reason, "seed")));
    expect(seed.map((r) => [r.amount, r.marketId])).toEqual([[-MARKET_SEED, m.id]]);
    const view = await getVisibleMarket(t.db, lea, m.id);
    expect(view?.percent).toBe(50);
  });

  it("2 · is refused with fewer than 100 coins", async () => {
    const lea = await member(9000n);
    await expect(createMarket(t.db, lea, input(), NOW)).rejects.toThrow(/pièces/);
    expect(await getBalance(t.db, lea)).toBe(9000n);
  });

  it("3 · is refused after 3 markets on the same Paris day, and allowed again the next day", async () => {
    const lea = await member(100000n);
    for (let i = 0; i < 3; i++) await createMarket(t.db, lea, input(), NOW);
    await expect(createMarket(t.db, lea, input(), NOW)).rejects.toThrow(/3 marchés/);
    // 23:30 UTC on Dec 1 is already Dec 2 in Paris.
    const tomorrow = new Date("2026-12-01T23:30:00Z");
    await expect(
      createMarket(t.db, lea, input({ closeAt: new Date(tomorrow.getTime() + 48 * HOUR) }), tomorrow),
    ).resolves.toBeDefined();
  });

  it("3 · holds the daily limit even with 5 creations at the same moment", async () => {
    const lea = await member(100000n);
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => createMarket(t.db, lea, input(), NOW)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await getBalance(t.db, lea)).toBe(100000n - 3n * MARKET_SEED);
  });

  it("4 · refuses a close date under 1 hour or over 3 months away", async () => {
    const lea = await member(30000n);
    await expect(createMarket(t.db, lea, input({ closeAt: new Date(NOW.getTime() + 0.5 * HOUR) }), NOW)).rejects.toThrow(/1 heure/);
    await expect(createMarket(t.db, lea, input({ closeAt: new Date("2027-04-01T09:00:00Z") }), NOW)).rejects.toThrow(/3 mois/);
    await expect(createMarket(t.db, lea, input({ closeAt: new Date(NOW.getTime() + HOUR) }), NOW)).resolves.toBeDefined();
    await expect(createMarket(t.db, lea, input({ closeAt: new Date("2027-03-01T09:00:00Z") }), NOW)).resolves.toBeDefined();
  });

  it("5 · is refused when the rules box isn't ticked", async () => {
    const lea = await member();
    await expect(createMarket(t.db, lea, input({ acceptedRules: false }), NOW)).rejects.toThrow(/règles/);
  });

  it("6 · is refused when the member may not create markets", async () => {
    const lea = await member();
    await t.db.update(profiles).set({ canCreate: false }).where(eq(profiles.id, lea));
    await expect(createMarket(t.db, lea, input(), NOW)).rejects.toThrow(/créer/);
  });

  it("refuses an empty question or judging line", async () => {
    const lea = await member();
    await expect(createMarket(t.db, lea, input({ question: "  ?  " }), NOW)).rejects.toThrow(/question/);
    await expect(createMarket(t.db, lea, input({ criteria: "" }), NOW)).rejects.toThrow(/saura/);
  });
});

describe("tagging a member", () => {
  it("7 · keeps the market hidden from everyone except the creator and the tagged member until they approve", async () => {
    const lea = await member();
    const tom = await member(0n);
    const sam = await member(0n);
    const m = await createMarket(t.db, lea, input({ tagIds: [tom] }), NOW);
    expect(m.status).toBe("pending_approval");

    expect(await getVisibleMarket(t.db, sam, m.id)).toBeNull();
    expect((await listVisibleMarkets(t.db, sam)).map((x) => x.id)).not.toContain(m.id);
    expect(await getVisibleMarket(t.db, lea, m.id)).not.toBeNull();
    expect(await getVisibleMarket(t.db, tom, m.id)).not.toBeNull();

    await respondToTag(t.db, tom, m.id, true);
    expect((await getVisibleMarket(t.db, sam, m.id))?.status).toBe("open");
    expect((await listVisibleMarkets(t.db, sam)).map((x) => x.id)).toContain(m.id);
  });

  it("stays pending until every tagged member has approved", async () => {
    const lea = await member();
    const tom = await member(0n);
    const ines = await member(0n);
    const m = await createMarket(t.db, lea, input({ tagIds: [tom, ines] }), NOW);
    await respondToTag(t.db, tom, m.id, true);
    expect((await getVisibleMarket(t.db, lea, m.id))?.status).toBe("pending_approval");
    await respondToTag(t.db, ines, m.id, true);
    expect((await getVisibleMarket(t.db, lea, m.id))?.status).toBe("open");
  });

  it("8 · a refusal cancels the market and gives the creator their 100 coins back", async () => {
    const lea = await member(15000n);
    const tom = await member(0n);
    const sam = await member(0n);
    const m = await createMarket(t.db, lea, input({ tagIds: [tom] }), NOW);
    await respondToTag(t.db, tom, m.id, false);
    expect(await getBalance(t.db, lea)).toBe(15000n);
    expect((await getVisibleMarket(t.db, lea, m.id))?.status).toBe("cancelled");
    expect(await getVisibleMarket(t.db, sam, m.id)).toBeNull();
  });

  it("9 · a tagged member can remove an approved market later: everyone gets back what they put in", async () => {
    const lea = await member(15000n);
    const tom = await member(20000n);
    const sam = await member(20000n);
    const m = await createMarket(t.db, lea, input({ tagIds: [tom] }), NOW);
    await respondToTag(t.db, tom, m.id, true);
    await insertTestBuy(t.db, m.id, sam, "YES", 5000n, { withLedger: true });
    await insertTestBuy(t.db, m.id, tom, "NO", 3000n, { withLedger: true });

    await removeMyMarket(t.db, tom, m.id);
    expect(await getBalance(t.db, lea)).toBe(15000n);
    expect(await getBalance(t.db, tom)).toBe(20000n);
    expect(await getBalance(t.db, sam)).toBe(20000n);
    // Removed by the tagged member: it disappears for everyone else.
    expect(await getVisibleMarket(t.db, sam, m.id)).toBeNull();
    await expect(removeMyMarket(t.db, tom, m.id)).rejects.toThrow();
  });

  it("only a tagged member can remove a market, and only once it isn't settled", async () => {
    const lea = await member();
    const tom = await member(0n);
    const sam = await member(0n);
    const m = await createMarket(t.db, lea, input({ tagIds: [tom] }), NOW);
    await expect(removeMyMarket(t.db, sam, m.id)).rejects.toThrow(/nommé/);
    await expect(removeMyMarket(t.db, lea, m.id)).rejects.toThrow(/nommé/);
  });

  it("a member can't answer a tag twice, or a tag that isn't theirs", async () => {
    const lea = await member();
    const tom = await member(0n);
    const sam = await member(0n);
    const m = await createMarket(t.db, lea, input({ tagIds: [tom] }), NOW);
    await expect(respondToTag(t.db, sam, m.id, true)).rejects.toThrow();
    await respondToTag(t.db, tom, m.id, true);
    await expect(respondToTag(t.db, tom, m.id, false)).rejects.toThrow();
  });

  it("10 · can tag only other members, at most 5", async () => {
    const lea = await member();
    const tom = await member(0n);
    await expect(createMarket(t.db, lea, input({ tagIds: ["00000000-0000-0000-0000-000000000000"] }), NOW)).rejects.toThrow(/membre/);
    await expect(createMarket(t.db, lea, input({ tagIds: [lea] }), NOW)).rejects.toThrow(/toi-même/);
    const many = await Promise.all([1, 2, 3, 4, 5, 6].map(() => member(0n)));
    await expect(createMarket(t.db, lea, input({ tagIds: many }), NOW)).rejects.toThrow(/5/);
    // The same member twice counts once.
    const m = await createMarket(t.db, lea, input({ tagIds: [tom, tom] }), NOW);
    const tags = await t.db.select().from(marketTags).where(eq(marketTags.marketId, m.id));
    expect(tags).toHaveLength(1);
  });
});

describe("listing markets", () => {
  it("lists open markets closing soonest first", async () => {
    const lea = await member(100000n);
    const sam = await member(0n);
    const later = await createMarket(t.db, lea, input({ closeAt: new Date(NOW.getTime() + 72 * HOUR) }), NOW);
    const sooner = await createMarket(t.db, lea, input({ closeAt: new Date(NOW.getTime() + 2 * HOUR) }), NOW);
    const ids = (await listVisibleMarkets(t.db, sam)).map((x) => x.id).filter((id) => id === later.id || id === sooner.id);
    expect(ids).toEqual([sooner.id, later.id]);
  });
});
