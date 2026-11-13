import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { markets, marketTags } from "@/db/schema";
import { cleanup, createRootMember, insertTestBuy, insertTestMarket, openTestDb } from "@/test/db";
import { getSharePreview } from "./share";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

async function market() {
  const creator = await createRootMember(t.db, t.users);
  return { creator: creator.id, id: await insertTestMarket(t.db, creator.id) };
}

describe("public share preview (decision 015)", () => {
  it("shows the question and the odds of an open market that names nobody", async () => {
    const { id } = await market();
    expect(await getSharePreview(t.db, id)).toMatchObject({ question: "Test market?", percent: 50, status: "open", outcome: null });
  });

  it("follows the price after a bet", async () => {
    const { id } = await market();
    const bettor = await createRootMember(t.db, t.users);
    await insertTestBuy(t.db, id, bettor.id, "YES", 5000n);
    expect((await getSharePreview(t.db, id))!.percent).toBeGreaterThan(50);
  });

  it("shows the result of a resolved market", async () => {
    const { id } = await market();
    await t.db.update(markets).set({ status: "resolved", outcome: "NO" }).where(eq(markets.id, id));
    expect(await getSharePreview(t.db, id)).toMatchObject({ status: "resolved", outcome: "NO" });
  });

  it("hides any market that names someone, even once they approved", async () => {
    const { id } = await market();
    const named = await createRootMember(t.db, t.users);
    await t.db.insert(marketTags).values({ marketId: id, memberId: named.id, status: "approved" });
    expect(await getSharePreview(t.db, id)).toBeNull();
  });

  it("hides reported, cancelled and pending markets", async () => {
    const reported = await market();
    await t.db.update(markets).set({ hiddenAt: new Date() }).where(eq(markets.id, reported.id));
    const cancelled = await market();
    await t.db.update(markets).set({ status: "cancelled" }).where(eq(markets.id, cancelled.id));
    const pending = await market();
    await t.db.update(markets).set({ status: "pending_approval" }).where(eq(markets.id, pending.id));
    for (const m of [reported, cancelled, pending]) expect(await getSharePreview(t.db, m.id)).toBeNull();
  });

  it("returns null for an unknown market", async () => {
    expect(await getSharePreview(t.db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
