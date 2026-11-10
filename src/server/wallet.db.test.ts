import { afterAll, afterEach, describe, expect, it } from "vitest";
import { STARTING_GRANT } from "@/core/ledger";
import { cleanup, createAuthUser, createRootMember, openTestDb } from "@/test/db";
import { createProfile } from "./members";
import { claimDailyDrop, getBalance, getHistory } from "./wallet";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

async function newMember(): Promise<string> {
  const root = await createRootMember(t.db, t.users);
  const userId = await createAuthUser(t.db, t.users);
  const nickname = `n${Math.random().toString(36).slice(2, 10)}`;
  await createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Léa", nickname });
  return userId;
}

// Noon in Paris on consecutive days (winter: UTC+1).
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 11, 0, 0));

describe("the daily drop", () => {
  it("pays 50 coins on the first day", async () => {
    const m = await newMember();
    const r = await claimDailyDrop(t.db, m, day(10));
    expect(r).toEqual({ amount: 5000n, streak: 1 });
    expect(await getBalance(t.db, m)).toBe(STARTING_GRANT + 5000n);
  });

  it("refuses a second claim the same Paris day, and pays nothing more", async () => {
    const m = await newMember();
    await claimDailyDrop(t.db, m, day(10));
    await expect(claimDailyDrop(t.db, m, new Date(Date.UTC(2026, 10, 10, 22, 30)))).rejects.toThrow("déjà");
    expect(await getBalance(t.db, m)).toBe(STARTING_GRANT + 5000n);
  });

  it("counts the day in Paris time: 23:30 UTC is already tomorrow", async () => {
    const m = await newMember();
    await claimDailyDrop(t.db, m, new Date(Date.UTC(2026, 10, 10, 22, 0))); // 23:00 Paris, the 10th
    const r = await claimDailyDrop(t.db, m, new Date(Date.UTC(2026, 10, 10, 23, 30))); // 00:30 Paris, the 11th
    expect(r.streak).toBe(2);
  });

  it("pays a two-tabs double click only once", async () => {
    const m = await newMember();
    const results = await Promise.allSettled([
      claimDailyDrop(t.db, m, day(10)),
      claimDailyDrop(t.db, m, day(10)),
      claimDailyDrop(t.db, m, day(10)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await getBalance(t.db, m)).toBe(STARTING_GRANT + 5000n);
  });

  it("grows by 10 coins per consecutive day, capped at +50 (decision 005)", async () => {
    const m = await newMember();
    const amounts: bigint[] = [];
    for (let d = 1; d <= 8; d++) amounts.push((await claimDailyDrop(t.db, m, day(d))).amount);
    expect(amounts).toEqual([5000n, 6000n, 7000n, 8000n, 9000n, 10000n, 10000n, 10000n]);
  });

  it("restarts the streak after a missed day", async () => {
    const m = await newMember();
    await claimDailyDrop(t.db, m, day(1));
    await claimDailyDrop(t.db, m, day(2));
    const r = await claimDailyDrop(t.db, m, day(4));
    expect(r).toEqual({ amount: 5000n, streak: 1 });
  });

  it("refuses a suspended member", async () => {
    const m = await newMember();
    const { profiles } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await t.db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, m));
    await expect(claimDailyDrop(t.db, m, day(10))).rejects.toThrow("suspendu");
  });

  it("refuses an account with no profile", async () => {
    const userId = await createAuthUser(t.db, t.users);
    await expect(claimDailyDrop(t.db, userId, day(10))).rejects.toThrow();
  });
});

describe("history", () => {
  it("lists every coin movement, newest first", async () => {
    const m = await newMember();
    await claimDailyDrop(t.db, m, day(10));
    const h = await getHistory(t.db, m);
    expect(h.map((r) => [r.reason, r.amount])).toEqual([
      ["drop", 5000n],
      ["grant", STARTING_GRANT],
    ]);
  });
});
