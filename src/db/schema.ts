import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { LEDGER_REASONS } from "../core/ledger";

/**
 * Database schema. Rules (see CLAUDE.md):
 * - every table has row-level security enabled with no policies, so the
 *   public API roles (anon, authenticated) can read and write nothing;
 * - only server code, connecting as the database owner, touches these tables;
 * - coins live in `ledger` only: a balance is the sum of a member's rows.
 */

export const memberRole = pgEnum("member_role", ["member", "admin"]);
export const ledgerReason = pgEnum("ledger_reason", LEDGER_REASONS);

export const profiles = pgTable(
  "profiles",
  {
    /** Same id as the Supabase Auth user. */
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    nickname: text("nickname").notNull(),
    role: memberRole("role").notNull().default("member"),
    /** This member's personal invite code, in every link they share. Rotating it revokes old links. */
    inviteCode: text("invite_code").notNull().unique(),
    /** Who brought this member in. Null only for the founding admin. */
    invitedBy: uuid("invited_by").references((): AnyPgColumn => profiles.id, { onDelete: "restrict" }),
    canCreate: boolean("can_create").notNull().default(true),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_nickname_lower_idx").on(sql`lower(${t.nickname})`),
    check("profiles_first_name_len", sql`char_length(${t.firstName}) between 1 and 40`),
    check("profiles_nickname_len", sql`char_length(${t.nickname}) between 2 and 24`),
  ],
).enableRLS();

export const ledger = pgTable(
  "ledger",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    /** Hundredths of a coin. Never zero. */
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    reason: ledgerReason("reason").notNull(),
    /** The market this movement belongs to (foreign key added with the markets table). */
    marketId: uuid("market_id"),
    /** Client-generated id that makes a retried request a no-op. */
    requestId: uuid("request_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_member_idx").on(t.memberId),
    index("ledger_market_idx").on(t.marketId),
    check("ledger_amount_not_zero", sql`${t.amount} <> 0`),
  ],
).enableRLS();

export const dailyClaims = pgTable(
  "daily_claims",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    /** The Paris calendar day, "YYYY-MM-DD". One claim per member per day. */
    day: date("day", { mode: "string" }).notNull(),
    /** Consecutive days including this one (1 = first day or after a gap). */
    streak: integer("streak").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.day] }), check("daily_claims_streak_positive", sql`${t.streak} >= 1`)],
).enableRLS();
