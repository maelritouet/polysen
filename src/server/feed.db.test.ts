import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { markets, trades } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, insertTestBuy, openTestDb } from "@/test/db";
import { getFeed } from "./feed";
import { createMarket, respondToTag } from "./markets";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;
async function member(coins = 50000n) {
  const m = await createRootMember(t.db, t.users);
  if (coins > 0n) await giveCoins(t.db, m.id, coins);
  return m.id;
}
const market = (creator: string, question: string, tagIds: string[] = []) =>
  createMarket(t.db, creator, {
    question,
    criteria: "Vote de la promo.",
    closeAt: new Date(Date.now() + 48 * HOUR),
    tagIds,
    acceptedRules: true,
  });

/** Only this test's events: the local DB may hold other data. */
const mine = (feed: Awaited<ReturnType<typeof getFeed>>, ids: string[]) => feed.filter((e) => ids.includes(e.marketId));

describe("the friends feed", () => {
  it("shows new markets and trades, newest first, with who did what", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await market(lea, "Le partiel sera-t-il dur ?");
    await t.db.update(markets).set({ createdAt: new Date(Date.now() - 3 * HOUR) }).where(eq(markets.id, m.id));
    await insertTestBuy(t.db, m.id, tom, "YES", 20000n);
    await t.db.update(trades).set({ createdAt: new Date(Date.now() - 2 * HOUR) }).where(eq(trades.marketId, m.id));
    await insertTestBuy(t.db, m.id, lea, "NO", 500n);

    const feed = mine(await getFeed(t.db, sam), [m.id]);
    expect(feed.map((e) => e.kind)).toEqual(["trade", "trade", "market"]);
    expect(feed[0]).toMatchObject({ kind: "trade", side: "NO", tradeKind: "buy", coins: 500n, question: "Le partiel sera-t-il dur ?" });
    expect(feed[1]).toMatchObject({ kind: "trade", side: "YES", coins: 20000n });
    expect(feed[2]).toMatchObject({ kind: "market", marketId: m.id });
    expect(feed.every((e) => typeof e.nickname === "string" && e.nickname.length > 0)).toBe(true);
    expect(feed.map((e) => e.memberId)).toEqual([lea, tom, lea]);
  });

  it("never shows a tagged market's events to others before every tag is approved", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await market(lea, "Tom viendra-t-il au run ?", [tom]);
    expect(mine(await getFeed(t.db, sam), [m.id])).toHaveLength(0);
    expect(mine(await getFeed(t.db, tom), [m.id])).toHaveLength(1); // the tagged member sees it
    await respondToTag(t.db, tom, m.id, true);
    expect(mine(await getFeed(t.db, sam), [m.id])).toHaveLength(1);
  });

  it("returns at most `limit` events", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea, "Combien de pizzas ce soir ?");
    for (let i = 0; i < 5; i++) await insertTestBuy(t.db, m.id, tom, "YES", 1000n);
    expect(await getFeed(t.db, lea, 3)).toHaveLength(3);
  });
});

describe("resolved markets in the feed", () => {
  it("shows a payout as an event dated when it settled", async () => {
    const { proposeResolution, runTick, DISPUTE_WINDOW_MS } = await import("./resolution");
    const lea = await member();
    const sam = await member();
    const m = await market(lea, "Le run aura-t-il lieu ?");
    await insertTestBuy(t.db, m.id, sam, "YES", 500n, { withLedger: true });
    await t.db.update(markets).set({ createdAt: new Date(Date.now() - 3 * HOUR), closeAt: new Date(Date.now() - HOUR) }).where(eq(markets.id, m.id));
    await proposeResolution(t.db, lea, { marketId: m.id, outcome: "YES", proof: "Photo du départ" });
    await runTick(t.db, new Date(Date.now() + DISPUTE_WINDOW_MS + 1000));
    const feed = mine(await getFeed(t.db, sam), [m.id]);
    expect(feed[0]).toMatchObject({ kind: "resolved", outcome: "YES", memberId: lea });
  });
});
