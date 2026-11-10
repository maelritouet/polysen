import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createRootMember, openTestDb } from "@/test/db";
import { claimDailyDrop } from "./wallet";

/**
 * The attack from the build plan: use Supabase's public API exactly as a
 * browser console could, with the publishable key, signed out and signed in,
 * and try to read or change every table. Everything must fail.
 *
 * Two locks make this hold: row-level security with no policies on every
 * table, and no table privileges for the API roles at all.
 */

const TABLES = ["profiles", "ledger", "daily_claims"] as const;

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
        // Untyped on purpose: an attacker sends whatever JSON they like.
        const row: Record<string, unknown> =
          table === "ledger"
            ? { member_id: victimId, amount: 99999900, reason: "grant" }
            : table === "daily_claims"
              ? { member_id: victimId, day: "2000-01-01", streak: 1 }
              : { id: victimId, first_name: "Hacker", nickname: "hacker", invite_code: "HACKED22" };
        const { error } = await client().from(table).insert(row);
        expect(error).not.toBeNull();
      });

      it(`cannot update ${table}`, async () => {
        const { data, error } = await client()
          .from(table)
          .update(table === "ledger" ? { amount: 99999900 } : table === "daily_claims" ? { streak: 99 } : { role: "admin" })
          .eq(table === "profiles" ? "id" : "member_id", victimId)
          .select();
        expect(data ?? []).toHaveLength(0);
        expect(error).not.toBeNull();
      });

      it(`cannot delete from ${table}`, async () => {
        const { data, error } = await client()
          .from(table)
          .delete()
          .eq(table === "profiles" ? "id" : "member_id", victimId)
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
