import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import { getLeaderboard } from "./leaderboard";
import { cancelMarket, createMarket } from "./markets";
import { buy, sell } from "./trading";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;
async function member() {
  const m = await createRootMember(t.db, t.users);
  await giveCoins(t.db, m.id, 100000n);
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
const sellAll = (who: string, marketId: string, side: "YES" | "NO") =>
  sell(t.db, who, { marketId, side, shares: "all", requestId: randomUUID() });
const row = (board: Awaited<ReturnType<typeof getLeaderboard>>["week"], id: string) => board.find((r) => r.memberId === id)!;

describe("the leaderboard", () => {
  it("counts a sale's profit this week once three people have traded the market", async () => {
    const [lea, tom, sam, ines] = [await member(), await member(), await member(), await member()];
    const m = await market(ines);
    await bet(lea, m.id, "YES", 10000n);
    await bet(tom, m.id, "YES", 20000n); // pushes YES up: Léa is in profit
    let board = await getLeaderboard(t.db);
    expect(row(board.week, lea).profit).toBe(0n); // nothing sold yet

    const sold = await sellAll(lea, m.id, "YES");
    board = await getLeaderboard(t.db);
    expect(row(board.week, lea).profit).toBe(0n); // only 2 players: the market doesn't count yet

    await bet(sam, m.id, "NO", 500n);
    board = await getLeaderboard(t.db);
    expect(row(board.week, lea).profit).toBe(sold.coins - 10000n);
    expect(row(board.season, lea).profit).toBe(sold.coins - 10000n);
    expect(row(board.week, lea).profit).toBeGreaterThan(0n);
    expect(row(board.week, ines).profit).toBe(0n); // creating a market is not trading
    expect(row(board.week, lea).nickname).toMatch(/^root-/);
  });

  it("a cancelled market nets every player to zero, profit taken back included", async () => {
    const [lea, tom, sam, ines] = [await member(), await member(), await member(), await member()];
    const m = await market(ines);
    await bet(lea, m.id, "YES", 10000n);
    await bet(tom, m.id, "YES", 20000n);
    await bet(sam, m.id, "NO", 3000n);
    await sellAll(lea, m.id, "YES");
    await t.db.transaction((tx) => cancelMarket(tx, m.id));
    const board = await getLeaderboard(t.db);
    for (const id of [lea, tom, sam, ines]) expect(row(board.week, id).profit).toBe(0n);
  });

  it("only counts gains inside the period", async () => {
    const [lea, tom, sam, ines] = [await member(), await member(), await member(), await member()];
    const m = await market(ines);
    await bet(lea, m.id, "YES", 10000n);
    await bet(tom, m.id, "YES", 20000n);
    await bet(sam, m.id, "NO", 500n);
    await sellAll(lea, m.id, "YES");
    const nextWeek = await getLeaderboard(t.db, new Date(Date.now() + 8 * 24 * HOUR));
    expect(row(nextWeek.week, lea).profit).toBe(0n);
  });
});
