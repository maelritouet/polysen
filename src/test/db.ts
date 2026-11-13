import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { inArray, or, sql } from "drizzle-orm";
import { newPool, quoteBuy, type Side } from "@/core/amm";
import { MARKET_SEED } from "@/core/ledger";
import { D } from "@/core/money";
import { createDb, type Db } from "@/db/client";
import { adminActions, avatars, comments, dailyClaims, disputes, reports, resolutions, ledger, markets, marketTags, profiles, trades } from "@/db/schema";

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

/**
 * Inserts an open market straight into the table, bypassing the server
 * functions. For schema and RLS tests only. Returns its id.
 */
export async function insertTestMarket(db: Db, creatorId: string, closeAt = new Date(Date.now() + 86_400_000)): Promise<string> {
  const pool = newPool(MARKET_SEED);
  const [m] = await db
    .insert(markets)
    .values({
      creatorId,
      question: "Test market?",
      criteria: "Test criteria",
      closeAt,
      status: "open",
      seed: MARKET_SEED,
      poolYes: pool.yes.toFixed(12),
      poolNo: pool.no.toFixed(12),
    })
    .returning({ id: markets.id });
  return m.id;
}

/**
 * Inserts a buy straight into `trades` and moves the market's pool with the
 * core's quote, bypassing the server functions (no ledger rows). Schema tests only.
 */
export async function insertTestBuy(
  db: Db,
  marketId: string,
  memberId: string,
  side: Side,
  coins: bigint,
  opts: { withLedger?: boolean } = {},
): Promise<void> {
  const [m] = await db.select({ yes: markets.poolYes, no: markets.poolNo }).from(markets).where(sql`${markets.id} = ${marketId}`);
  const q = quoteBuy({ yes: D(m.yes), no: D(m.no) }, side, coins);
  await db.insert(trades).values({
    marketId,
    memberId,
    side,
    kind: "buy",
    coins,
    shares: q.shares.toFixed(12),
    probBefore: q.probBefore.toFixed(12),
    probAfter: q.probAfter.toFixed(12),
    requestId: randomUUID(),
  });
  await db
    .update(markets)
    .set({ poolYes: q.pool.yes.toFixed(12), poolNo: q.pool.no.toFixed(12) })
    .where(sql`${markets.id} = ${marketId}`);
  if (opts.withLedger) await db.insert(ledger).values({ memberId, amount: -coins, reason: "bet", marketId });
}

/** Gives a test member coins with a grant row. */
export async function giveCoins(db: Db, memberId: string, amount: bigint): Promise<void> {
  await db.insert(ledger).values({ memberId, amount, reason: "grant" });
}

/** Deletes everything the test users created, then the users themselves. */
export async function cleanup(db: Db, users: Set<string>): Promise<void> {
  const ids = [...users];
  if (!ids.length) return;
  const theirMarkets = db.select({ id: markets.id }).from(markets).where(inArray(markets.creatorId, ids));
  await db.delete(dailyClaims).where(inArray(dailyClaims.memberId, ids));
  await db.delete(ledger).where(or(inArray(ledger.memberId, ids), inArray(ledger.marketId, theirMarkets)));
  await db.delete(adminActions).where(or(inArray(adminActions.adminId, ids), inArray(adminActions.memberId, ids), inArray(adminActions.marketId, theirMarkets)));
  await db.delete(reports).where(or(inArray(reports.reporterId, ids), inArray(reports.marketId, theirMarkets)));
  const theirResolutions = db.select({ id: resolutions.id }).from(resolutions).where(or(inArray(resolutions.proposedBy, ids), inArray(resolutions.marketId, theirMarkets)));
  await db.delete(disputes).where(or(inArray(disputes.memberId, ids), inArray(disputes.resolutionId, theirResolutions)));
  await db.delete(resolutions).where(or(inArray(resolutions.proposedBy, ids), inArray(resolutions.marketId, theirMarkets)));
  await db.delete(comments).where(or(inArray(comments.memberId, ids), inArray(comments.marketId, theirMarkets)));
  await db.delete(trades).where(or(inArray(trades.memberId, ids), inArray(trades.marketId, theirMarkets)));
  await db.delete(marketTags).where(or(inArray(marketTags.memberId, ids), inArray(marketTags.marketId, theirMarkets)));
  await db.delete(markets).where(inArray(markets.creatorId, ids));
  await db.update(profiles).set({ invitedBy: null }).where(inArray(profiles.invitedBy, ids));
  await db.delete(avatars).where(inArray(avatars.memberId, ids));
  await db.delete(profiles).where(inArray(profiles.id, ids));
  await db.execute(sql`delete from auth.users where id in ${ids}`);
  users.clear();
}
