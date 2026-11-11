import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { cleanup, createRootMember, giveCoins, openTestDb } from "@/test/db";
import { addComment, COMMENTS_PER_MINUTE, deleteMyComment, getInsiders, listComments, MAX_COMMENT } from "./comments";
import { createMarket, respondToTag } from "./markets";
import { buy } from "./trading";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

const HOUR = 3_600_000;
async function member() {
  const m = await createRootMember(t.db, t.users);
  await giveCoins(t.db, m.id, 100000n);
  return m.id;
}
const market = (creator: string, tagIds: string[] = []) =>
  createMarket(t.db, creator, {
    question: "Tom viendra-t-il au run ?",
    criteria: "Photo du run.",
    closeAt: new Date(Date.now() + 48 * HOUR),
    tagIds,
    acceptedRules: true,
  });
const bet = (who: string, marketId: string, side: "YES" | "NO", coins: bigint) =>
  buy(t.db, who, { marketId, side, coins, requestId: randomUUID() });

describe("comments", () => {
  it("are listed newest first with who wrote them and what they hold", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea);
    await bet(tom, m.id, "NO", 3000n);
    await addComment(t.db, lea, m.id, "  Il ne se lèvera jamais.  ");
    await addComment(t.db, tom, m.id, "On parie ?");
    const list = await listComments(t.db, lea, m.id);
    expect(list.map((c) => c.body)).toEqual(["On parie ?", "Il ne se lèvera jamais."]);
    expect(list[0]).toMatchObject({ memberId: tom, holding: "NO" });
    expect(list[1]).toMatchObject({ memberId: lea, holding: null });
    expect(list[0].nickname).toMatch(/^root-/);
  });

  it("refuse an empty or too long text", async () => {
    const lea = await member();
    const m = await market(lea);
    await expect(addComment(t.db, lea, m.id, "   ")).rejects.toThrow(/vide/);
    await expect(addComment(t.db, lea, m.id, "x".repeat(MAX_COMMENT + 1))).rejects.toThrow(/500/);
    await addComment(t.db, lea, m.id, "x".repeat(MAX_COMMENT));
  });

  it("can't be read or written on a market the member can't see", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await market(lea, [tom]);
    await expect(addComment(t.db, sam, m.id, "Coucou")).rejects.toThrow(/introuvable/);
    await expect(listComments(t.db, sam, m.id)).rejects.toThrow(/introuvable/);
    await addComment(t.db, tom, m.id, "Je suis tagué, je vois."); // the tagged member can
    await respondToTag(t.db, tom, m.id, true);
    expect(await listComments(t.db, sam, m.id)).toHaveLength(1);
  });

  it(`allow at most ${COMMENTS_PER_MINUTE} per minute per member`, async () => {
    const lea = await member();
    const m = await market(lea);
    const now = new Date();
    for (let i = 0; i < COMMENTS_PER_MINUTE; i++) await addComment(t.db, lea, m.id, `msg ${i}`, now);
    await expect(addComment(t.db, lea, m.id, "encore", now)).rejects.toThrow(/Doucement/);
    await addComment(t.db, lea, m.id, "plus tard", new Date(now.getTime() + 61_000));
  });

  it("can be deleted by their author only, leaving a trace in the thread", async () => {
    const lea = await member();
    const tom = await member();
    const m = await market(lea);
    const id = await addComment(t.db, tom, m.id, "Oups");
    await expect(deleteMyComment(t.db, lea, id)).rejects.toThrow(/pas le tien/);
    await deleteMyComment(t.db, tom, id);
    const [c] = await listComments(t.db, lea, m.id);
    expect(c.body).toBeNull();
  });
});

describe("insider badge", () => {
  it("names the creator and tagged members who hold a position, and nobody else", async () => {
    const lea = await member();
    const tom = await member();
    const sam = await member();
    const m = await market(lea, [tom]);
    await respondToTag(t.db, tom, m.id, true);
    expect(await getInsiders(t.db, m.id)).toEqual([]);
    await bet(lea, m.id, "YES", 1000n);
    await bet(tom, m.id, "NO", 2000n);
    await bet(sam, m.id, "YES", 5000n);
    const insiders = await getInsiders(t.db, m.id);
    expect(insiders.map((i) => [i.memberId, i.role, i.sides])).toEqual([
      [lea, "creator", ["YES"]],
      [tom, "tagged", ["NO"]],
    ]);
  });
});
