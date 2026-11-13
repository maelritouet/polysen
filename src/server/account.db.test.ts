import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { comments, ledger, markets, marketTags, profiles } from "@/db/schema";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import { deleteAccount } from "./account";
import { addComment } from "./comments";
import { createMarket } from "./markets";
import { buy } from "./trading";
import { getBalance } from "./wallet";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;

async function member(coins = 500_000n) {
  const m = await createRootMember(t.db, t.users);
  if (coins > 0n) await giveCoins(t.db, m.id, coins);
  return m.id;
}

async function market(creator: string, tagIds: string[] = []) {
  const { id } = await createMarket(t.db, creator, {
    question: "Tom viendra-t-il au run de vendredi ?",
    criteria: "Photo du run.",
    closeAt: new Date(Date.now() + 48 * HOUR),
    tagIds,
    acceptedRules: true,
  });
  return id;
}

const profileOf = async (id: string) => (await t.db.select().from(profiles).where(eq(profiles.id, id)))[0];

describe("deleting an account (decision 016)", () => {
  it("scrubs the names and the sign-in, and keeps the bets in the totals", async () => {
    const creator = await member();
    const leaver = await member();
    const m = await market(creator);
    await buy(t.db, leaver, { marketId: m, side: "YES", coins: 1000n, requestId: randomUUID() });
    const before = await profileOf(leaver);
    const balanceBefore = await getBalance(t.db, leaver);

    await deleteAccount(t.db, leaver);

    const after = await profileOf(leaver);
    expect(after.nickname).toMatch(/^ancien-[a-z0-9]{6}$/);
    expect(after.firstName).toBe("Ancien membre");
    expect(after.inviteCode).not.toBe(before.inviteCode);
    expect(after.deletedAt).not.toBeNull();
    expect(after.suspendedAt).not.toBeNull();
    expect(after.canCreate).toBe(false);

    const [auth] = await t.db.execute<{ email: string; encrypted_password: string; banned_until: string | null }>(
      sql`select email, encrypted_password, banned_until::text from auth.users where id = ${leaver}`,
    );
    expect(auth.email).toBe(`${leaver}@supprime.invalid`);
    expect(auth.encrypted_password).toBe("");
    expect(auth.banned_until).toBe("infinity");

    // The bet is still on the market and in the ledger.
    expect(await getBalance(t.db, leaver)).toBe(balanceBefore);
    const rows = await t.db.select().from(ledger).where(eq(ledger.memberId, leaver));
    expect(rows.some((r) => r.reason === "bet" && r.marketId === m)).toBe(true);
  });

  it("cancels and refunds running markets that name the leaver", async () => {
    const creator = await member();
    const leaver = await member();
    const bettor = await member();
    const pending = await market(creator, [leaver]);
    const open = await market(creator, [leaver]);
    await t.db.update(marketTags).set({ status: "approved" }).where(eq(marketTags.marketId, open));
    await t.db.update(markets).set({ status: "open" }).where(eq(markets.id, open));
    const bettorBefore = await getBalance(t.db, bettor);
    await buy(t.db, bettor, { marketId: open, side: "NO", coins: 2000n, requestId: randomUUID() });

    await deleteAccount(t.db, leaver);

    for (const id of [pending, open]) {
      const [row] = await t.db.select({ status: markets.status }).from(markets).where(eq(markets.id, id));
      expect(row.status).toBe("cancelled");
    }
    expect(await getBalance(t.db, bettor)).toBe(bettorBefore);
  });

  it("deletes the leaver's comments", async () => {
    const creator = await member();
    const leaver = await member();
    const m = await market(creator);
    await addComment(t.db, leaver, m, "Je dis oui, j'ai des infos");
    await deleteAccount(t.db, leaver);
    const [c] = await t.db.select({ deletedAt: comments.deletedAt }).from(comments).where(eq(comments.memberId, leaver));
    expect(c.deletedAt).not.toBeNull();
  });

  it("is refused while a market they created is still running, and changes nothing", async () => {
    const leaver = await member();
    await market(leaver);
    const before = await profileOf(leaver);
    await expect(deleteAccount(t.db, leaver)).rejects.toThrow(/marché en cours/);
    expect(await profileOf(leaver)).toEqual(before);
  });

  it("is refused for an admin", async () => {
    const admin = await member(0n);
    await t.db.update(profiles).set({ role: "admin" }).where(eq(profiles.id, admin));
    await expect(deleteAccount(t.db, admin)).rejects.toThrow(/admin/);
  });

  it("cannot run twice", async () => {
    const leaver = await member(0n);
    await deleteAccount(t.db, leaver);
    await expect(deleteAccount(t.db, leaver)).rejects.toThrow(/n'existe plus/);
  });
});
