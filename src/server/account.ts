import { randomInt } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { avatars, comments, markets, marketTags, profiles } from "@/db/schema";
import { UserError } from "./errors";
import { cancelMarket } from "./markets";
import { generateInviteCode } from "./members";

const NAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** "ancien-k7m2qp": the name a deleted member's past bets keep. */
export function anonymousNickname(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += NAME_ALPHABET[randomInt(NAME_ALPHABET.length)];
  return `ancien-${s}`;
}

/**
 * Deletes a member's account (PRD "Personal data", decision 016), all or nothing:
 * - markets that name them and are still running are cancelled and refunded,
 *   as if they had pressed « Retirer » (their consent ends with the account);
 * - their comments and their photo are deleted;
 * - their first name, nickname and invite code are replaced, and they can no
 *   longer sign in (e-mail, password and Google link scrubbed from Supabase Auth);
 * - their bets, sales and payouts stay in the ledger, so every total still adds up.
 * Refused for an admin, and while a market they created is still running
 * (nobody else could propose its result).
 */
export async function deleteAccount(db: Db, memberId: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    // Same lock order as trading and cancels: markets first (by id), then members.
    const named = await tx
      .select({ id: markets.id })
      .from(markets)
      .innerJoin(marketTags, eq(marketTags.marketId, markets.id))
      .where(and(eq(marketTags.memberId, memberId), inArray(markets.status, ["open", "pending_approval"])))
      .orderBy(asc(markets.id))
      .for("update", { of: markets });

    const [me] = await tx
      .select({ role: profiles.role, deletedAt: profiles.deletedAt })
      .from(profiles)
      .where(eq(profiles.id, memberId))
      .for("update");
    if (!me || me.deletedAt) throw new UserError("Ce compte n'existe plus.");
    if (me.role === "admin") throw new UserError("Un admin ne peut pas supprimer son compte : donne d'abord le rôle à quelqu'un d'autre.");

    const [running] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(markets)
      .where(and(eq(markets.creatorId, memberId), inArray(markets.status, ["open", "pending_approval"])));
    if (running.n > 0) {
      throw new UserError(
        running.n === 1
          ? "Tu as un marché en cours : attends son résultat, ou demande à l'admin de l'annuler."
          : `Tu as ${running.n} marchés en cours : attends leur résultat, ou demande à l'admin de les annuler.`,
      );
    }

    for (const { id } of named) {
      await tx
        .update(marketTags)
        .set({ status: "refused", respondedAt: now })
        .where(and(eq(marketTags.marketId, id), eq(marketTags.memberId, memberId)));
      await cancelMarket(tx, id, now);
    }

    await tx
      .update(comments)
      .set({ deletedAt: now })
      .where(and(eq(comments.memberId, memberId), isNull(comments.deletedAt)));

    await tx.delete(avatars).where(eq(avatars.memberId, memberId));

    await tx
      .update(profiles)
      .set({
        firstName: "Ancien membre",
        nickname: anonymousNickname(),
        inviteCode: generateInviteCode(),
        canCreate: false,
        suspendedAt: now,
        deletedAt: now,
      })
      .where(eq(profiles.id, memberId));

    // The auth row stays (profiles points at it), emptied of anything personal.
    await tx.execute(sql`
      update auth.users
         set email = ${`${memberId}@supprime.invalid`},
             encrypted_password = '',
             phone = null,
             raw_user_meta_data = '{}'::jsonb,
             banned_until = 'infinity',
             updated_at = ${now.toISOString()}::timestamptz
       where id = ${memberId}`);
    await tx.execute(sql`delete from auth.identities where user_id = ${memberId}`);
    await tx.execute(sql`delete from auth.sessions where user_id = ${memberId}`);
  });
}
