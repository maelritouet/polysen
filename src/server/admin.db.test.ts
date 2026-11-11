import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { markets, profiles } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import {
  adminDeleteComment,
  adminDismissReport,
  adminResolve,
  adminRestoreMarket,
  adminSetCanCreate,
  adminSetSuspended,
  getAdminLog,
  getAdminQueue,
  reportComment,
  reportMarket,
} from "./admin";
import { addComment, listComments } from "./comments";
import { createMarket, getVisibleMarket } from "./markets";
import { disputeResolution, getResolution, NO_RESULT_DEADLINE_MS, proposeResolution } from "./resolution";
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
async function admin() {
  const id = await member();
  await t.db.update(profiles).set({ role: "admin" }).where(eq(profiles.id, id));
  return id;
}
const market = async (creator: string) =>
  (
    await createMarket(t.db, creator, {
      question: "Le partiel sera-t-il dur ?",
      criteria: "Vote de la promo.",
      closeAt: new Date(Date.now() + 2 * HOUR),
      tagIds: [],
      acceptedRules: true,
    })
  ).id;
const close = (id: string, hoursAgo = 1) =>
  t.db
    .update(markets)
    .set({ createdAt: new Date(Date.now() - (hoursAgo + 2) * HOUR), closeAt: new Date(Date.now() - hoursAgo * HOUR) })
    .where(eq(markets.id, id));
const bet = (who: string, marketId: string, side: "YES" | "NO", coins: bigint) =>
  buy(t.db, who, { marketId, side, coins, requestId: randomUUID() });
const queueFor = async (ids: string[]) => {
  const q = await getAdminQueue(t.db);
  return {
    disputes: q.disputes.filter((d) => ids.includes(d.marketId)),
    overdue: q.overdue.filter((o) => ids.includes(o.marketId)),
    reports: q.reports.filter((r) => ids.includes(r.marketId)),
  };
};

describe("reports", () => {
  it("a single report hides a market and pauses its betting until the admin restores it", async () => {
    const lea = await member();
    const tom = await member();
    const boss = await admin();
    const m = await market(lea);
    await reportMarket(t.db, tom, m, "Ça vise quelqu'un de la promo");
    expect(await getVisibleMarket(t.db, tom, m)).toBeNull();
    expect(await getVisibleMarket(t.db, lea, m)).not.toBeNull(); // the creator still sees it
    await expect(bet(lea, m, "YES", 1000n)).rejects.toThrow(/signalé/);
    await expect(reportMarket(t.db, tom, m, "Encore")).rejects.toThrow(/introuvable|déjà/);
    expect((await queueFor([m])).reports).toHaveLength(1);

    await expect(adminRestoreMarket(t.db, tom, m)).rejects.toThrow(/admin/);
    await adminRestoreMarket(t.db, boss, m);
    expect(await getVisibleMarket(t.db, tom, m)).not.toBeNull();
    expect((await queueFor([m])).reports).toHaveLength(0);
    await bet(lea, m, "YES", 1000n);
  });

  it("a reported comment goes to the admin, who can delete it", async () => {
    const lea = await member();
    const tom = await member();
    const boss = await admin();
    const m = await market(lea);
    const c = await addComment(t.db, lea, m, "Message limite");
    await reportComment(t.db, tom, c, "Insulte");
    expect(await getVisibleMarket(t.db, tom, m)).not.toBeNull(); // a comment report doesn't hide the market
    const [r] = (await queueFor([m])).reports;
    expect(r).toMatchObject({ commentId: c, commentBody: "Message limite", reason: "Insulte" });
    await adminDeleteComment(t.db, boss, c);
    expect((await listComments(t.db, tom, m))[0].body).toBeNull();
    expect((await queueFor([m])).reports).toHaveLength(0);
  });

  it("a report can be dismissed", async () => {
    const lea = await member();
    const tom = await member();
    const boss = await admin();
    const m = await market(lea);
    const c = await addComment(t.db, lea, m, "Ok");
    await reportComment(t.db, tom, c, "Bof");
    const [r] = (await queueFor([m])).reports;
    await adminDismissReport(t.db, boss, r.id);
    expect((await queueFor([m])).reports).toHaveLength(0);
  });
});

describe("rulings", () => {
  it("the admin settles a disputed result, possibly the other way, and the log shows it", async () => {
    const lea = await member();
    const tom = await member();
    const boss = await admin();
    const m = await market(lea);
    await bet(tom, m, "NO", 3000n);
    await close(m);
    await proposeResolution(t.db, lea, { marketId: m, outcome: "YES", proof: "Trust me" });
    await disputeResolution(t.db, tom, (await getResolution(t.db, m))!.id, "C'était facile");
    const [d] = (await queueFor([m])).disputes;
    expect(d).toMatchObject({ proposed: "YES", proof: "Trust me" });
    expect(d.reasons).toEqual([expect.objectContaining({ reason: "C'était facile" })]);

    const before = await getBalance(t.db, tom);
    await adminResolve(t.db, boss, m, "NO", "Le sujet était facile d'après tous");
    expect(await getBalance(t.db, tom)).toBeGreaterThan(before + 3000n);
    const [row] = await t.db.select().from(markets).where(eq(markets.id, m));
    expect(row).toMatchObject({ status: "resolved", outcome: "NO" });
    expect(await getResolution(t.db, m)).toMatchObject({ outcome: "NO", status: "accepted" });
    expect((await queueFor([m])).disputes).toHaveLength(0);
    await expect(adminResolve(t.db, boss, m, "YES", "Re")).rejects.toThrow(/déjà/);

    const log = (await getAdminLog(t.db)).filter((l) => l.marketId === m);
    expect(log).toEqual([expect.objectContaining({ kind: "resolve", note: "Non · Le sujet était facile d'après tous" })]);
  });

  it("an admin who traded on the market, or created it, can't rule on it", async () => {
    const boss = await admin();
    const lea = await member();
    const m = await market(lea);
    await bet(boss, m, "YES", 1000n);
    await close(m);
    await expect(adminResolve(t.db, boss, m, "YES", "")).rejects.toThrow(/autre admin/);
    const own = await market(boss);
    await expect(adminResolve(t.db, boss, own, "CANCEL", "")).rejects.toThrow(/autre admin/);
  });

  it("lists markets with no result 48 hours after the close, and the admin can cancel them", async () => {
    const lea = await member();
    const tom = await member();
    const boss = await admin();
    const m = await market(lea);
    await bet(tom, m, "YES", 2000n);
    await close(m, 49);
    expect((await queueFor([m])).overdue).toEqual([expect.objectContaining({ marketId: m })]);
    expect(NO_RESULT_DEADLINE_MS).toBe(48 * HOUR);
    const start = await getBalance(t.db, tom);
    await adminResolve(t.db, boss, m, "CANCEL", "Plus de nouvelles");
    expect(await getBalance(t.db, tom)).toBe(start + 2000n);
    expect((await queueFor([m])).overdue).toHaveLength(0);
  });
});

describe("members", () => {
  it("the admin can suspend a member and take away their right to create, never their own", async () => {
    const lea = await member();
    const boss = await admin();
    await adminSetSuspended(t.db, boss, lea, true);
    const [p] = await t.db.select().from(profiles).where(eq(profiles.id, lea));
    expect(p.suspendedAt).not.toBeNull();
    await adminSetSuspended(t.db, boss, lea, false);
    await adminSetCanCreate(t.db, boss, lea, false);
    await expect(market(lea)).rejects.toThrow();
    await expect(adminSetSuspended(t.db, boss, boss, true)).rejects.toThrow(/toi-même/);
    const kinds = (await getAdminLog(t.db)).filter((l) => l.memberId === lea).map((l) => l.kind);
    expect(kinds).toEqual(["revoke_create", "unsuspend", "suspend"]);
  });
});
