import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { STARTING_GRANT } from "@/core/ledger";
import { ledger, profiles } from "@/db/schema";
import { cleanup, createAuthUser, createRootMember, openTestDb } from "@/test/db";
import { createProfile, rotateInviteCode } from "./members";
import { getBalance } from "./wallet";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const nick = () => `n${Math.random().toString(36).slice(2, 10)}`;

describe("joining with an invite link", () => {
  it("creates the profile, records the inviter and grants 1,000 coins", async () => {
    const root = await createRootMember(t.db, t.users);
    const userId = await createAuthUser(t.db, t.users);

    const p = await createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Léa", nickname: nick() });

    expect(p.invitedBy).toBe(root.id);
    expect(p.role).toBe("member");
    expect(await getBalance(t.db, userId)).toBe(STARTING_GRANT);
    const rows = await t.db.select().from(ledger).where(eq(ledger.memberId, userId));
    expect(rows.map((r) => r.reason)).toEqual(["grant"]);
  });

  it("gives the new member their own invite code", async () => {
    const root = await createRootMember(t.db, t.users);
    const userId = await createAuthUser(t.db, t.users);
    const p = await createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Tom", nickname: nick() });
    expect(p.inviteCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(p.inviteCode).not.toBe(root.inviteCode);
  });

  it("accepts the code in any letter case and with stray spaces", async () => {
    const root = await createRootMember(t.db, t.users);
    const userId = await createAuthUser(t.db, t.users);
    const code = ` ${root.inviteCode.toLowerCase()} `;
    const p = await createProfile(t.db, { userId, inviteCode: code, firstName: "Inès", nickname: nick() });
    expect(p.invitedBy).toBe(root.id);
  });

  it("refuses an unknown code, and creates nothing", async () => {
    const userId = await createAuthUser(t.db, t.users);
    await expect(
      createProfile(t.db, { userId, inviteCode: "NOPE2345", firstName: "Hugo", nickname: nick() }),
    ).rejects.toThrow("invitation");
    expect(await getBalance(t.db, userId)).toBe(0n);
    expect(await t.db.select().from(profiles).where(eq(profiles.id, userId))).toHaveLength(0);
  });

  it("refuses a code from a suspended member", async () => {
    const root = await createRootMember(t.db, t.users);
    await t.db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, root.id));
    const userId = await createAuthUser(t.db, t.users);
    await expect(
      createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Hugo", nickname: nick() }),
    ).rejects.toThrow("invitation");
  });

  it("refuses a second profile for the same account, and grants coins only once", async () => {
    const root = await createRootMember(t.db, t.users);
    const userId = await createAuthUser(t.db, t.users);
    await createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Léa", nickname: nick() });
    await expect(
      createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Léa", nickname: nick() }),
    ).rejects.toThrow("déjà");
    expect(await getBalance(t.db, userId)).toBe(STARTING_GRANT);
  });

  it("grants coins only once even when the form is submitted twice at the same moment", async () => {
    const root = await createRootMember(t.db, t.users);
    const userId = await createAuthUser(t.db, t.users);
    const results = await Promise.allSettled([
      createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Léa", nickname: nick() }),
      createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Léa", nickname: nick() }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await getBalance(t.db, userId)).toBe(STARTING_GRANT);
  });

  it("refuses a nickname already taken, whatever the letter case", async () => {
    const root = await createRootMember(t.db, t.users);
    const a = await createAuthUser(t.db, t.users);
    const b = await createAuthUser(t.db, t.users);
    const n = nick();
    await createProfile(t.db, { userId: a, inviteCode: root.inviteCode, firstName: "A", nickname: n });
    await expect(
      createProfile(t.db, { userId: b, inviteCode: root.inviteCode, firstName: "B", nickname: n.toUpperCase() }),
    ).rejects.toThrow("pseudo");
    expect(await getBalance(t.db, b)).toBe(0n);
  });

  it("refuses empty, too long or odd names", async () => {
    const root = await createRootMember(t.db, t.users);
    const userId = await createAuthUser(t.db, t.users);
    const bad = [
      { firstName: "  ", nickname: nick() },
      { firstName: "x".repeat(41), nickname: nick() },
      { firstName: "Léa", nickname: "a" },
      { firstName: "Léa", nickname: "x".repeat(25) },
      { firstName: "Léa", nickname: "<script>" },
    ];
    for (const b of bad) {
      await expect(createProfile(t.db, { userId, inviteCode: root.inviteCode, ...b })).rejects.toThrow();
    }
    expect(await getBalance(t.db, userId)).toBe(0n);
  });
});

describe("rotating your invite code", () => {
  it("replaces the code, and the old one stops working", async () => {
    const root = await createRootMember(t.db, t.users);
    const fresh = await rotateInviteCode(t.db, root.id);
    expect(fresh).not.toBe(root.inviteCode);

    const userId = await createAuthUser(t.db, t.users);
    await expect(
      createProfile(t.db, { userId, inviteCode: root.inviteCode, firstName: "Old", nickname: nick() }),
    ).rejects.toThrow("invitation");
    const p = await createProfile(t.db, { userId, inviteCode: fresh, firstName: "New", nickname: nick() });
    expect(p.invitedBy).toBe(root.id);
  });
});
