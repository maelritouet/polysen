import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { inArray, sql } from "drizzle-orm";
import { createDb, type Db } from "@/db/client";
import { dailyClaims, ledger, profiles } from "@/db/schema";

/**
 * Helpers for tests that run against the local Supabase database
 * (`supabase start`). Each test creates its own throwaway users and
 * `cleanup()` deletes exactly those, so your local data is left alone.
 */

config({ path: ".env.local", quiet: true });
const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function openTestDb(): { db: Db; close: () => Promise<void>; users: Set<string> } {
  const { db, close } = createDb(process.env.DATABASE_URL ?? LOCAL_URL, { max: 10 });
  return { db, close, users: new Set() };
}

/** Creates a Supabase Auth user directly in the database and returns its id. */
export async function createAuthUser(db: Db, users: Set<string>): Promise<string> {
  const id = randomUUID();
  await db.execute(sql`
    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            ${`${id}@test.polysen.local`}, now(), now())`);
  users.add(id);
  return id;
}

/** A member with no inviter, to invite others in tests. Returns { id, inviteCode }. */
export async function createRootMember(db: Db, users: Set<string>): Promise<{ id: string; inviteCode: string }> {
  const id = await createAuthUser(db, users);
  const inviteCode = `T${id.replaceAll("-", "").slice(0, 9).toUpperCase()}`;
  await db.insert(profiles).values({ id, firstName: "Root", nickname: `root-${id.slice(0, 8)}`, inviteCode });
  return { id, inviteCode };
}

/** Deletes everything the test users created, then the users themselves. */
export async function cleanup(db: Db, users: Set<string>): Promise<void> {
  const ids = [...users];
  if (!ids.length) return;
  await db.delete(dailyClaims).where(inArray(dailyClaims.memberId, ids));
  await db.delete(ledger).where(inArray(ledger.memberId, ids));
  await db.update(profiles).set({ invitedBy: null }).where(inArray(profiles.invitedBy, ids));
  await db.delete(profiles).where(inArray(profiles.id, ids));
  await db.execute(sql`delete from auth.users where id in ${ids}`);
  users.clear();
}
