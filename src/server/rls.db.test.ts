import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createRootMember, insertTestBuy, insertTestMarket, openTestDb } from "@/test/db";
import { comments, marketTags } from "@/db/schema";
import { claimDailyDrop } from "./wallet";

/**
 * The attack from the build plan: use Supabase's public API exactly as a
 * browser console could, with the publishable key, signed out and signed in,
 * and try to read or change every table. Everything must fail.
 *
 * Two locks make this hold: row-level security with no policies on every
 * table, and no table privileges for the API roles at all.
 */

const TABLES = ["profiles", "ledger", "daily_claims", "markets", "market_tags", "trades", "positions", "comments", "resolutions", "disputes"] as const;
type Table = (typeof TABLES)[number];

/** The column that points at the victim in each table. */
const OWNER: Record<Table, string> = {
  profiles: "id",
  ledger: "member_id",
  daily_claims: "member_id",
  markets: "creator_id",
  market_tags: "member_id",
  trades: "member_id",
  positions: "member_id",
  comments: "member_id",
  resolutions: "proposed_by",
  disputes: "member_id",
};

/** What an attacker would try to write. Untyped on purpose: they send whatever JSON they like. */
function attackRow(table: Table, victimId: string): Record<string, unknown> {
  switch (table) {
    case "ledger":
      return { member_id: victimId, amount: 99999900, reason: "grant" };
    case "daily_claims":
      return { member_id: victimId, day: "2000-01-01", streak: 1 };
    case "profiles":
      return { id: victimId, first_name: "Hacker", nickname: "hacker", invite_code: "HACKED22" };
    case "markets":
      return { creator_id: victimId, question: "Hacked?", criteria: "yes", close_at: "2099-01-01", status: "open", seed: 1, pool_yes: 1, pool_no: 1 };
    case "market_tags":
      return { market_id: "00000000-0000-0000-0000-000000000000", member_id: victimId, status: "approved" };
    case "resolutions":
      return { market_id: "00000000-0000-0000-0000-000000000000", proposed_by: victimId, outcome: "YES", proof: "hacked", status: "accepted" };
    case "disputes":
      return { resolution_id: 1, member_id: victimId, reason: "hacked" };
    case "comments":
      return { member_id: victimId, market_id: "00000000-0000-0000-0000-000000000000", body: "hacked" };
    case "trades":
    case "positions":
      return { member_id: victimId, market_id: "00000000-0000-0000-0000-000000000000", side: "YES", kind: "sell", coins: 99999900, shares: 1 };
  }
}

const ATTACK_UPDATE: Record<Table, Record<string, unknown>> = {
  profiles: { role: "admin" },
  ledger: { amount: 99999900 },
  daily_claims: { streak: 99 },
  markets: { status: "cancelled" },
  market_tags: { status: "approved" },
  trades: { coins: 99999900 },
  positions: { invested: -99999900 },
  comments: { body: "hacked" },
  resolutions: { status: "accepted" },
  disputes: { reason: "hacked" },
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const t = openTestDb();
let victimId = "";
let anon: SupabaseClient;
let signedIn: SupabaseClient;
let attackerEmail = "";

beforeAll(async () => {
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set: run `supabase status -o env`");
  // A victim with real rows in every table.
  const victim = await createRootMember(t.db, t.users);
  victimId = victim.id;
  await claimDailyDrop(t.db, victimId);
  const marketId = await insertTestMarket(t.db, victimId);
  await insertTestBuy(t.db, marketId, victimId, "YES", 1000n);
  await t.db.insert(marketTags).values({ marketId, memberId: victimId });
  await t.db.insert(comments).values({ marketId, memberId: victimId, body: "Hello" });

  anon = createClient(url, key, { auth: { persistSession: false } });

  // An attacker with a real account, signed in through Supabase Auth.
  signedIn = createClient(url, key, { auth: { persistSession: false } });
  attackerEmail = `attacker-${Date.now()}@test.polysen.local`;
  const { data, error } = await signedIn.auth.signUp({ email: attackerEmail, password: "attacker-password-123" });
  if (error || !data.session) throw new Error(`Could not sign up the attacker: ${error?.message ?? "no session"}`);
  t.users.add(data.user!.id);
});

afterAll(async () => {
  await cleanup(t.db, t.users);
  await t.close();
});

for (const who of ["signed out", "signed in"] as const) {
  describe(`attacking through the public API, ${who}`, () => {
    const client = () => (who === "signed out" ? anon : signedIn);

    for (const table of TABLES) {
      it(`cannot read ${table}`, async () => {
        const { data, error } = await client().from(table).select("*");
        expect(data ?? []).toHaveLength(0);
        expect(error).not.toBeNull();
      });

      it(`cannot insert into ${table}`, async () => {
        const { error } = await client().from(table).insert(attackRow(table, victimId));
        expect(error).not.toBeNull();
      });

      it(`cannot update ${table}`, async () => {
        const { data, error } = await client()
          .from(table)
          .update(ATTACK_UPDATE[table])
          .eq(OWNER[table], victimId)
          .select();
        expect(data ?? []).toHaveLength(0);
        expect(error).not.toBeNull();
      });

      it(`cannot delete from ${table}`, async () => {
        const { data, error } = await client()
          .from(table)
          .delete()
          .eq(OWNER[table], victimId)
          .select();
        expect(data ?? []).toHaveLength(0);
        expect(error).not.toBeNull();
      });
    }
  });
}

describe("after the attacks", () => {
  it("the victim's data is untouched", async () => {
    const rows = await t.db.execute<{ n: string }>(
      sql`select count(*)::text as n from ledger where member_id = ${victimId}`,
    );
    expect(rows[0].n).toBe("1"); // the daily drop; root members get no grant row
  });
});
