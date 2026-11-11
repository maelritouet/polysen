import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { markets, resolutions } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import { getLeaderboard } from "./leaderboard";
import { createMarket } from "./markets";
import { DISPUTE_WINDOW_MS, APPROVAL_TIMEOUT_MS, disputeResolution, getResolution, proposeResolution, runTick } from "./resolution";
import { buy } from "./trading";
import { getBalance } from "./wallet";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;
async function member() {
  const m = await createRootMember(t.db, t.users);
  await giveCoins(t.db, m.id, 100000n);
  return m.id;
}
async function closedMarket(creator: string, tagIds: string[] = []) {
  const m = await createMarket(t.db, creator, {
    question: "Le partiel sera-t-il dur ?",
    criteria: "Vote de la promo.",
    closeAt: new Date(Date.now() + 2 * HOUR),
    tagIds,
    acceptedRules: true,
  });
  return m.id;
}
/** Moves a market's close into the past, as if time had passed. */
const close = (id: string) =>
  t.db.update(markets).set({ createdAt: new Date(Date.now() - 3 * HOUR), closeAt: new Date(Date.now() - HOUR) }).where(eq(markets.id, id));
const bet = (who: string, marketId: string, side: "YES" | "NO", coins: bigint) =>
  buy(t.db, who, { marketId, side, coins, requestId: randomUUID() });
const later = (ms: number) => new Date(Date.now() + ms + 1000);
/** Only this test's markets: the local DB may hold other data. */
const mine = (r: { paid: string[]; cancelled: string[] }, ids: string[]) => ({
  paid: r.paid.filter((id) => ids.includes(id)),
  cancelled: r.cancelled.filter((id) => ids.includes(id)),
});

describe("proposing a result", () => {
  it("is for the creator only, once betting has closed, with proof", async () => {
    const lea = await member();
    const tom = await member();
    const m = await closedMarket(lea);
    await expect(proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: "Photo du sujet" })).rejects.toThrow(/encore ouverts/);
    await close(m);
    await expect(proposeResolution(t.db, tom, { marketId: m, outcome: "YES", proof: "Photo du sujet" })).rejects.toThrow(/créat/);
    await expect(proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: " " })).rejects.toThrow(/preuve/);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: "Photo du sujet" });
    await expect(proposeResolution(t.db, lea, { marketId: m, outcome: "NO", proof: "Changement d'avis" })).rejects.toThrow(/déjà/);
    expect(await getResolution(t.db, m)).toMatchObject({ outcome: "YES", status: "proposed", disputes: 0 });
  });
});

describe("the payout job", () => {
  it("pays out 24 hours after the proposal, not before, and only once", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await closedMarket(lea);
    await bet(tom, m, "YES", 20000n);
    await bet(sam, m, "NO", 5000n);
    await bet(lea, m, "YES", 1000n); // a third player, so the market counts on the leaderboard
    await close(m);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: "Photo du sujet" });
    const before = await getBalance(t.db, tom);

    expect(mine(await runTick(t.db, later(DISPUTE_WINDOW_MS - 2 * 60_000)), [m]).paid).toEqual([]);
    expect(mine(await runTick(t.db, later(DISPUTE_WINDOW_MS)), [m]).paid).toEqual([m]);
    const after = await getBalance(t.db, tom);
    expect(after).toBeGreaterThan(before + 20000n); // won: more than the stake back
    expect(mine(await runTick(t.db, later(DISPUTE_WINDOW_MS)), [m]).paid).toEqual([]); // safe to run twice
    expect(await getBalance(t.db, tom)).toBe(after);

    const [row] = await t.db.select().from(markets).where(eq(markets.id, m));
    expect(row).toMatchObject({ status: "resolved", outcome: "YES" });
    expect(row.settledAt).not.toBeNull();
    expect(await getResolution(t.db, m)).toMatchObject({ status: "accepted" });

    // Every coin that went in came out: the market nets to zero (rule 12).
    const [net] = await t.db.execute<{ n: string }>(sql`select coalesce(sum(amount), 0)::text as n from ledger where market_id = ${m} and reason <> 'creator_bonus'`);
    expect(net.n).toBe("0");

    // The leaderboard sees it: Sam lost his stake, at the settlement.
    const board = await getLeaderboard(t.db, later(DISPUTE_WINDOW_MS));
    expect(board.week.find((r) => r.memberId === sam)!.profit).toBe(-5000n);
  });

  it("two jobs at once still pay out exactly once", async () => {
    const lea = await member();
    const tom = await member();
    const m = await closedMarket(lea);
    await bet(tom, m, "NO", 3000n);
    await close(m);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "NO", proof: "Message de Tom" });
    const at = later(DISPUTE_WINDOW_MS);
    const [a, b] = await Promise.all([runTick(t.db, at), runTick(t.db, at)]);
    expect([...mine(a, [m]).paid, ...mine(b, [m]).paid]).toEqual([m]);
    const [n] = await t.db.execute<{ n: string }>(sql`select count(*)::text as n from ledger where market_id = ${m} and reason = 'payout'`);
    expect(n.n).toBe("1");
  });

  it("a proposed cancel refunds everyone after the window", async () => {
    const lea = await member();
    const tom = await member();
    const m = await closedMarket(lea);
    const start = await getBalance(t.db, tom);
    await bet(tom, m, "YES", 4000n);
    await close(m);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "CANCEL", proof: "Le partiel est reporté" });
    expect(mine(await runTick(t.db, later(DISPUTE_WINDOW_MS)), [m]).paid).toEqual([m]);
    expect(await getBalance(t.db, tom)).toBe(start);
    const [row] = await t.db.select().from(markets).where(eq(markets.id, m));
    expect(row).toMatchObject({ status: "cancelled", outcome: null });
  });

  it("cancels a market still waiting for a tagged member's approval after 48 hours", async () => {
    const lea = await member();
    const tom = await member();
    const m = await closedMarket(lea, [tom]);
    const start = await getBalance(t.db, lea);
    expect(mine(await runTick(t.db, later(APPROVAL_TIMEOUT_MS - 2 * 60_000)), [m]).cancelled).toEqual([]);
    expect(mine(await runTick(t.db, later(APPROVAL_TIMEOUT_MS)), [m]).cancelled).toEqual([m]);
    expect(await getBalance(t.db, lea)).toBe(start + 10000n); // seed back
  });
});

describe("disputes", () => {
  it("one dispute from a player stops the payout and sends it to the admin", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await closedMarket(lea);
    await bet(tom, m, "NO", 3000n);
    await close(m);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: "Trust me" });
    const r = (await getResolution(t.db, m))!;
    await expect(disputeResolution(t.db, sam, r.id, "Je n'ai pas parié mais bon")).rejects.toThrow(/joueurs/);
    await expect(disputeResolution(t.db, tom, r.id, "")).rejects.toThrow(/raison/);
    await disputeResolution(t.db, tom, r.id, "Le sujet était facile, j'y étais");
    await expect(disputeResolution(t.db, tom, r.id, "Encore")).rejects.toThrow(/déjà/);
    expect(await getResolution(t.db, m)).toMatchObject({ status: "disputed", disputes: 1 });
    expect(mine(await runTick(t.db, later(DISPUTE_WINDOW_MS)), [m]).paid).toEqual([]);
    const [row] = await t.db.select().from(markets).where(eq(markets.id, m));
    expect(row.status).toBe("open");
  });

  it("closes when the 24-hour window ends", async () => {
    const lea = await member();
    const tom = await member();
    const m = await closedMarket(lea);
    await bet(tom, m, "NO", 3000n);
    await close(m);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: "Trust me" });
    const r = (await getResolution(t.db, m))!;
    await t.db.update(resolutions).set({ createdAt: new Date(Date.now() - DISPUTE_WINDOW_MS - 1000) }).where(eq(resolutions.id, r.id));
    await expect(disputeResolution(t.db, tom, r.id, "Trop tard ?")).rejects.toThrow(/24 h/);
  });
});
