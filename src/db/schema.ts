import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  pgView,
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
/** pending_approval: a tagged member hasn't approved yet. The result states come in phase 5. */
export const marketStatus = pgEnum("market_status", ["pending_approval", "open", "resolved", "cancelled"]);
export const tagStatus = pgEnum("tag_status", ["pending", "approved", "refused"]);
export const tradeSide = pgEnum("trade_side", ["YES", "NO"]);
export const tradeKind = pgEnum("trade_kind", ["buy", "sell"]);

/**
 * Shares, kept exactly: the core rounds every share amount to 12 decimals and
 * coins are hundredths, so a pool or a position always fits in scale 12 with
 * no rounding at all. Read back as strings and parsed with `D`.
 */
const shares = (name: string) => numeric(name, { precision: 32, scale: 12 });

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
    /** Set when the member deleted their account: names scrubbed, sign-in gone, bets kept (decision 016). */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
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
    /** The market this movement belongs to, if any. */
    marketId: uuid("market_id").references((): AnyPgColumn => markets.id, { onDelete: "restrict" }),
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

export const markets = pgTable(
  "markets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    question: text("question").notNull(),
    /** "How we'll know": one line on how the result will be judged. */
    criteria: text("criteria").notNull(),
    closeAt: timestamp("close_at", { withTimezone: true }).notNull(),
    status: marketStatus("status").notNull(),
    /** The creator's seed, in hundredths. */
    seed: bigint("seed", { mode: "bigint" }).notNull(),
    /** YES and NO shares held by the pool. */
    poolYes: shares("pool_yes").notNull(),
    poolNo: shares("pool_no").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** The result once paid out (null for a cancel or an unsettled market). */
    outcome: tradeSide("outcome"),
    /** When the market was paid out or cancelled. */
    settledAt: timestamp("settled_at", { withTimezone: true }),
    /** Set by a report: hidden from everyone but its creator until the admin looks (PRD). */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  },
  (t) => [
    index("markets_creator_created_idx").on(t.creatorId, t.createdAt),
    index("markets_status_close_idx").on(t.status, t.closeAt),
    check("markets_question_len", sql`char_length(${t.question}) between 5 and 200`),
    check("markets_criteria_len", sql`char_length(${t.criteria}) between 3 and 300`),
    check("markets_seed_positive", sql`${t.seed} > 0`),
    check("markets_pool_positive", sql`${t.poolYes} > 0 and ${t.poolNo} > 0`),
    check("markets_close_after_creation", sql`${t.closeAt} > ${t.createdAt}`),
  ],
).enableRLS();

/** A member named in a market. The market stays hidden until every tag is approved. */
export const marketTags = pgTable(
  "market_tags",
  {
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    status: tagStatus("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.marketId, t.memberId] }), index("market_tags_member_idx").on(t.memberId)],
).enableRLS();

/** Every buy and sale, append-only. Positions and the price history come from here. */
export const trades = pgTable(
  "trades",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    side: tradeSide("side").notNull(),
    kind: tradeKind("kind").notNull(),
    /** Hundredths: the amount bet (buy) or the proceeds (sell). Always positive. */
    coins: bigint("coins", { mode: "bigint" }).notNull(),
    shares: shares("shares").notNull(),
    /** Probability of YES around the trade, for the price chart (rounded to 12 decimals). */
    probBefore: numeric("prob_before", { precision: 13, scale: 12 }).notNull(),
    probAfter: numeric("prob_after", { precision: 13, scale: 12 }).notNull(),
    /** Client-generated id: replaying the same request writes nothing new. */
    requestId: uuid("request_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trades_market_idx").on(t.marketId, t.id),
    index("trades_member_idx").on(t.memberId),
    check("trades_coins_positive", sql`${t.coins} > 0`),
    check("trades_shares_positive", sql`${t.shares} > 0`),
  ],
).enableRLS();

export const resolutionOutcome = pgEnum("resolution_outcome", ["YES", "NO", "CANCEL"]);
/**
 * proposed: waiting out the 24-hour window · disputed: waiting for an admin ·
 * accepted: paid out · overturned: an admin ruled otherwise.
 */
export const resolutionStatus = pgEnum("resolution_status", ["proposed", "disputed", "accepted", "overturned"]);

/** A proposed result (PRD: the creator proposes, it pays out 24 hours later unless disputed). */
export const resolutions = pgTable(
  "resolutions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    proposedBy: uuid("proposed_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    outcome: resolutionOutcome("outcome").notNull(),
    /** A link, a witness, what was seen. */
    proof: text("proof").notNull(),
    status: resolutionStatus("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("resolutions_status_created_idx").on(t.status, t.createdAt),
    // At most one live proposal per market.
    uniqueIndex("resolutions_one_live_idx").on(t.marketId).where(sql`status in ('proposed', 'disputed')`),
    check("resolutions_proof_len", sql`char_length(${t.proof}) between 3 and 500`),
  ],
).enableRLS();

/** A player saying a proposed result is wrong. One is enough to send it to the admin. */
export const disputes = pgTable(
  "disputes",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    resolutionId: bigint("resolution_id", { mode: "bigint" })
      .notNull()
      .references(() => resolutions.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("disputes_one_per_member_idx").on(t.resolutionId, t.memberId),
    check("disputes_reason_len", sql`char_length(${t.reason}) between 3 and 300`),
  ],
).enableRLS();

/** A market's comment thread. Deleting (by its author, or the admin in phase 5) only hides the text. */
export const comments = pgTable(
  "comments",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("comments_market_idx").on(t.marketId, t.id),
    index("comments_member_created_idx").on(t.memberId, t.createdAt),
    check("comments_body_len", sql`char_length(${t.body}) between 1 and 500`),
  ],
).enableRLS();

/** A member flagging a market, or a comment in it, for the admin. */
export const reports = pgTable(
  "reports",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    /** Set when the report is about one comment rather than the market. */
    commentId: bigint("comment_id", { mode: "bigint" }).references(() => comments.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_open_idx").on(t.handledAt, t.createdAt),
    uniqueIndex("reports_once_idx").on(t.reporterId, t.marketId, sql`coalesce(${t.commentId}, 0)`),
    check("reports_reason_len", sql`char_length(${t.reason}) between 3 and 300`),
  ],
).enableRLS();

export const adminActionKind = pgEnum("admin_action_kind", [
  "resolve",
  "cancel",
  "restore_market",
  "delete_comment",
  "dismiss_report",
  "suspend",
  "unsuspend",
  "revoke_create",
  "restore_create",
]);

/** Everything an admin does, readable by every member (PRD: "so friends can see I was fair"). */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    kind: adminActionKind("kind").notNull(),
    marketId: uuid("market_id").references(() => markets.id, { onDelete: "restrict" }),
    commentId: bigint("comment_id", { mode: "bigint" }).references(() => comments.id, { onDelete: "restrict" }),
    memberId: uuid("member_id").references(() => profiles.id, { onDelete: "restrict" }),
    /** The outcome for a ruling, or the admin's note. */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_actions_created_idx").on(t.createdAt), check("admin_actions_note_len", sql`char_length(${t.note}) <= 300`)],
).enableRLS();

/**
 * Each member's position in each market, summed from their trades.
 * `invested` = coins bet − coins received from sales (core's Position.invested).
 * security_invoker: the view runs with the caller's rights, so RLS on `trades`
 * applies through it (a plain view would run as its owner and skip RLS).
 */
export const positions = pgView("positions", {
  marketId: uuid("market_id").notNull(),
  memberId: uuid("member_id").notNull(),
  yes: shares("yes").notNull(),
  no: shares("no").notNull(),
  invested: bigint("invested", { mode: "bigint" }).notNull(),
})
  .with({ securityInvoker: true })
  .as(
    sql`select market_id, member_id,
      coalesce(sum(case when side = 'YES' then (case when kind = 'buy' then shares else -shares end) end), 0) as yes,
      coalesce(sum(case when side = 'NO' then (case when kind = 'buy' then shares else -shares end) end), 0) as no,
      sum(case when kind = 'buy' then coins else -coins end)::bigint as invested
    from trades group by market_id, member_id`,
  );
