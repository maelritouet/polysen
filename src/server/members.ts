import { randomInt } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { STARTING_GRANT } from "@/core/ledger";
import type { Db } from "@/db/client";
import { ledger, profiles } from "@/db/schema";
import { uniqueViolation, UserError } from "./errors";

export type Profile = typeof profiles.$inferSelect;

/** Letters and digits that can't be confused with each other (no 0/O, 1/I/L). */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

const NICKNAME = /^[\p{L}\p{N}_.\- ]+$/u;

function cleanNames(input: { firstName: string; nickname: string }): { firstName: string; nickname: string } {
  const firstName = input.firstName.trim();
  const nickname = input.nickname.trim();
  if (firstName.length < 1 || firstName.length > 40) throw new UserError("Ton prénom doit faire entre 1 et 40 caractères.");
  if (nickname.length < 2 || nickname.length > 24) throw new UserError("Ton pseudo doit faire entre 2 et 24 caractères.");
  if (!NICKNAME.test(nickname)) throw new UserError("Ton pseudo ne peut contenir que des lettres, des chiffres, des espaces et _ . -");
  return { firstName, nickname };
}

/**
 * Turns a signed-in account into a member: checks the invite code, creates the
 * profile with its own invite code, and grants the starting coins. All or nothing.
 */
export async function createProfile(
  db: Db,
  input: { userId: string; inviteCode: string; firstName: string; nickname: string },
): Promise<Profile> {
  const { firstName, nickname } = cleanNames(input);
  const code = normalizeInviteCode(input.inviteCode);

  try {
    return await db.transaction(async (tx) => {
      const [inviter] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.inviteCode, code), isNull(profiles.suspendedAt)));
      if (!inviter) throw new UserError("Ce lien d'invitation n'est pas valide. Demande un nouveau lien à la personne qui t'a invité·e.");

      const [profile] = await tx
        .insert(profiles)
        .values({ id: input.userId, firstName, nickname, inviteCode: generateInviteCode(), invitedBy: inviter.id })
        .returning();
      await tx.insert(ledger).values({ memberId: profile.id, amount: STARTING_GRANT, reason: "grant" });
      return profile;
    });
  } catch (err) {
    const constraint = uniqueViolation(err);
    if (constraint === "profiles_pkey") throw new UserError("Tu as déjà un profil.");
    if (constraint === "profiles_nickname_lower_idx") throw new UserError("Ce pseudo est déjà pris.");
    if (constraint === "profiles_invite_code_unique") throw new UserError("Petit souci technique, réessaie.");
    throw err;
  }
}

/** Gives a member a new invite code. Links with the old one stop working. */
export async function rotateInviteCode(db: Db, memberId: string): Promise<string> {
  const code = generateInviteCode();
  const updated = await db.update(profiles).set({ inviteCode: code }).where(eq(profiles.id, memberId)).returning({ id: profiles.id });
  if (!updated.length) throw new UserError("Profil introuvable.");
  return code;
}

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, userId));
  return p ?? null;
}

/** The inviter's first name for an invite code, to greet a newcomer. Null if the code is invalid. */
export async function inviterForCode(db: Db, code: string): Promise<{ firstName: string; nickname: string } | null> {
  const [p] = await db
    .select({ firstName: profiles.firstName, nickname: profiles.nickname })
    .from(profiles)
    .where(and(eq(profiles.inviteCode, normalizeInviteCode(code)), isNull(profiles.suspendedAt)));
  return p ?? null;
}

/**
 * Creates the very first member, the admin, who has no inviter.
 * Refuses if an admin already exists. Run once, from the command line.
 */
export async function bootstrapAdmin(
  db: Db,
  input: { email: string; firstName: string; nickname: string },
): Promise<Profile> {
  const { firstName, nickname } = cleanNames(input);
  return db.transaction(async (tx) => {
    const [admin] = await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, "admin"));
    if (admin) throw new Error("An admin already exists: invite people with their link instead.");
    const rows = await tx.execute<{ id: string }>(sql`select id from auth.users where lower(email) = lower(${input.email})`);
    const user = rows[0];
    if (!user) throw new Error(`No account with email ${input.email}: sign up in the app first.`);
    const [profile] = await tx
      .insert(profiles)
      .values({ id: user.id, firstName, nickname, inviteCode: generateInviteCode(), role: "admin" })
      .returning();
    await tx.insert(ledger).values({ memberId: profile.id, amount: STARTING_GRANT, reason: "grant" });
    return profile;
  });
}

/** Members who can be tagged in a market (not suspended), by nickname. */
export async function listMembers(db: Db): Promise<Array<{ id: string; firstName: string; nickname: string }>> {
  return db
    .select({ id: profiles.id, firstName: profiles.firstName, nickname: profiles.nickname })
    .from(profiles)
    .where(isNull(profiles.suspendedAt))
    .orderBy(asc(sql`lower(${profiles.nickname})`));
}
