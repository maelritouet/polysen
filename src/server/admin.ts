import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, Tx } from "@/db/client";
import { adminActions, adminActionKind, comments, disputes, markets, profiles, reports, resolutions, trades } from "@/db/schema";
import { UserError, uniqueViolation } from "./errors";
import { getVisibleMarket } from "./markets";
import { NO_RESULT_DEADLINE_MS, settle, type Outcome } from "./resolution";

/**
 * Admin tools (PRD "Admin tools"). Every function checks the admin role in
 * the database itself: the admin page is not the security boundary. Every
 * action is logged, and every member can read the log.
 */

type ActionKind = (typeof adminActionKind.enumValues)[number];
const OUTCOME_LABEL: Record<Outcome, string> = { YES: "Oui", NO: "Non", CANCEL: "Annulé" };

async function assertAdmin(db: Db | Tx, memberId: string): Promise<void> {
  const [p] = await db.select({ role: profiles.role, suspendedAt: profiles.suspendedAt }).from(profiles).where(eq(profiles.id, memberId));
  if (!p || p.role !== "admin" || p.suspendedAt) throw new UserError("Réservé à l'admin.");
}

async function log(
  tx: Db | Tx,
  adminId: string,
  kind: ActionKind,
  target: { marketId?: string; commentId?: bigint; memberId?: string; note?: string },
  now: Date,
) {
  await tx.insert(adminActions).values({ adminId, kind, ...target, note: target.note?.slice(0, 300) || null, createdAt: now });
}

const cleanReason = (text: string) => {
  const reason = text.trim();
  if (reason.length < 3) throw new UserError("Dis en quelques mots pourquoi.");
  if (reason.length > 300) throw new UserError("300 caractères maximum.");
  return reason;
};

// ---- reports (any member) ----

/** Reports a market: it is hidden from everyone but its creator until the admin looks. */
export async function reportMarket(db: Db, reporterId: string, marketId: string, text: string, now: Date = new Date()): Promise<void> {
  const reason = cleanReason(text);
  if (!(await getVisibleMarket(db, reporterId, marketId))) throw new UserError("Marché introuvable.");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(reports).values({ reporterId, marketId, reason, createdAt: now });
      await tx.update(markets).set({ hiddenAt: now }).where(and(eq(markets.id, marketId), isNull(markets.hiddenAt)));
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) throw new UserError("Tu as déjà signalé ce marché.");
    throw err;
  }
}

/** Reports one comment: it stays visible, the admin decides. Returns its market id. */
export async function reportComment(db: Db, reporterId: string, commentId: bigint, text: string, now: Date = new Date()): Promise<string> {
  const reason = cleanReason(text);
  const [c] = await db.select({ marketId: comments.marketId }).from(comments).where(eq(comments.id, commentId));
  if (!c || !(await getVisibleMarket(db, reporterId, c.marketId))) throw new UserError("Message introuvable.");
  try {
    await db.insert(reports).values({ reporterId, marketId: c.marketId, commentId, reason, createdAt: now });
  } catch (err) {
    if (uniqueViolation(err) !== null) throw new UserError("Tu as déjà signalé ce message.");
    throw err;
  }
  return c.marketId;
}

// ---- rulings ----

/**
 * Resolves or cancels a market with the admin's ruling, now: for a disputed
 * result, an overdue market, or a report. An admin who created the market or
 * traded on it can't rule: the backup admin does (PRD).
 */
export async function adminResolve(db: Db, adminId: string, marketId: string, outcome: Outcome, text: string, now: Date = new Date()): Promise<void> {
  await assertAdmin(db, adminId);
  const note = text.trim();
  await db.transaction(async (tx) => {
    const [m] = await tx.select().from(markets).where(eq(markets.id, marketId)).for("update");
    if (!m) throw new UserError("Marché introuvable.");
    const cancellable = m.status === "open" || m.status === "pending_approval";
    if (outcome === "CANCEL" ? !cancellable : m.status !== "open") throw new UserError("Ce marché est déjà réglé.");
    if (outcome !== "CANCEL" && m.closeAt > now) throw new UserError("Les paris sont encore ouverts : annule-le, ou attends la fermeture.");
    const [traded] = await tx.select({ id: trades.id }).from(trades).where(and(eq(trades.marketId, marketId), eq(trades.memberId, adminId))).limit(1);
    if (m.creatorId === adminId || traded) throw new UserError("Tu es impliqué dans ce marché : c'est à l'autre admin de trancher.");

    const [live] = await tx
      .select()
      .from(resolutions)
      .where(and(eq(resolutions.marketId, marketId), inArray(resolutions.status, ["proposed", "disputed"])));
    if (live) {
      await tx
        .update(resolutions)
        .set({ status: live.outcome === outcome ? "accepted" : "overturned", decidedAt: now })
        .where(eq(resolutions.id, live.id));
    }
    await tx.insert(resolutions).values({
      marketId,
      proposedBy: adminId,
      outcome,
      proof: note.length >= 3 ? note.slice(0, 500) : "Décision de l'admin",
      status: "accepted",
      createdAt: now,
      decidedAt: now,
    });
    await settle(tx, marketId, outcome, now);
    await tx.update(reports).set({ handledAt: now }).where(and(eq(reports.marketId, marketId), isNull(reports.handledAt)));
    await log(tx, adminId, outcome === "CANCEL" ? "cancel" : "resolve", {
      marketId,
      note: outcome === "CANCEL" ? note : [OUTCOME_LABEL[outcome], note].filter(Boolean).join(" · "),
    }, now);
  });
}

/** The report was unfounded: the market is visible again and its reports are closed. */
export async function adminRestoreMarket(db: Db, adminId: string, marketId: string, now: Date = new Date()): Promise<void> {
  await assertAdmin(db, adminId);
  await db.transaction(async (tx) => {
    await tx.update(markets).set({ hiddenAt: null }).where(eq(markets.id, marketId));
    await tx
      .update(reports)
      .set({ handledAt: now })
      .where(and(eq(reports.marketId, marketId), isNull(reports.commentId), isNull(reports.handledAt)));
    await log(tx, adminId, "restore_market", { marketId }, now);
  });
}

export async function adminDeleteComment(db: Db, adminId: string, commentId: bigint, now: Date = new Date()): Promise<void> {
  await assertAdmin(db, adminId);
  await db.transaction(async (tx) => {
    const [c] = await tx.update(comments).set({ deletedAt: now }).where(eq(comments.id, commentId)).returning({ marketId: comments.marketId });
    if (!c) throw new UserError("Message introuvable.");
    await tx.update(reports).set({ handledAt: now }).where(and(eq(reports.commentId, commentId), isNull(reports.handledAt)));
    await log(tx, adminId, "delete_comment", { marketId: c.marketId, commentId }, now);
  });
}

export async function adminDismissReport(db: Db, adminId: string, reportId: bigint, now: Date = new Date()): Promise<void> {
  await assertAdmin(db, adminId);
  await db.transaction(async (tx) => {
    const [r] = await tx
      .update(reports)
      .set({ handledAt: now })
      .where(and(eq(reports.id, reportId), isNull(reports.handledAt)))
      .returning({ marketId: reports.marketId, commentId: reports.commentId });
    if (!r) throw new UserError("Signalement déjà traité.");
    await log(tx, adminId, "dismiss_report", { marketId: r.marketId, commentId: r.commentId ?? undefined }, now);
  });
}

// ---- members ----

export async function adminSetSuspended(db: Db, adminId: string, memberId: string, suspended: boolean, now: Date = new Date()): Promise<void> {
  await assertAdmin(db, adminId);
  if (memberId === adminId) throw new UserError("Tu ne peux pas te suspendre toi-même.");
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ deletedAt: profiles.deletedAt }).from(profiles).where(eq(profiles.id, memberId)).for("update");
    if (!target) throw new UserError("Membre introuvable.");
    // A deleted account has no name and no sign-in left: there is nothing to bring back (decision 016).
    if (target.deletedAt) throw new UserError("Ce compte a été supprimé par son propriétaire.");
    await tx.update(profiles).set({ suspendedAt: suspended ? now : null }).where(eq(profiles.id, memberId));
    await log(tx, adminId, suspended ? "suspend" : "unsuspend", { memberId }, now);
  });
}

export async function adminSetCanCreate(db: Db, adminId: string, memberId: string, canCreate: boolean, now: Date = new Date()): Promise<void> {
  await assertAdmin(db, adminId);
  await db.transaction(async (tx) => {
    await tx.update(profiles).set({ canCreate }).where(eq(profiles.id, memberId));
    await log(tx, adminId, canCreate ? "restore_create" : "revoke_create", { memberId }, now);
  });
}

// ---- reads ----

export interface AdminQueue {
  disputes: Array<{
    resolutionId: bigint;
    marketId: string;
    question: string;
    proposed: Outcome;
    proof: string;
    reasons: Array<{ nickname: string; reason: string; createdAt: Date }>;
  }>;
  overdue: Array<{ marketId: string; question: string; closeAt: Date; creator: string }>;
  reports: Array<{
    id: bigint;
    marketId: string;
    question: string;
    hidden: boolean;
    commentId: bigint | null;
    commentBody: string | null;
    reporter: string;
    reason: string;
    createdAt: Date;
  }>;
  members: Array<{ id: string; nickname: string; firstName: string; role: "member" | "admin"; suspended: boolean; canCreate: boolean }>;
}

/** Everything waiting for the admin, oldest first. Callers must check the role (the page uses requireAdmin). */
export async function getAdminQueue(db: Db, now: Date = new Date()): Promise<AdminQueue> {
  const reporter = alias(profiles, "reporter");
  const creator = alias(profiles, "creator");
  const [disputed, reasons, overdue, open, members] = await Promise.all([
    db
      .select({ resolutionId: resolutions.id, marketId: markets.id, question: markets.question, proposed: resolutions.outcome, proof: resolutions.proof })
      .from(resolutions)
      .innerJoin(markets, eq(markets.id, resolutions.marketId))
      .where(eq(resolutions.status, "disputed"))
      .orderBy(asc(resolutions.createdAt)),
    db
      .select({ resolutionId: disputes.resolutionId, nickname: profiles.nickname, reason: disputes.reason, createdAt: disputes.createdAt })
      .from(disputes)
      .innerJoin(resolutions, eq(resolutions.id, disputes.resolutionId))
      .innerJoin(profiles, eq(profiles.id, disputes.memberId))
      .where(eq(resolutions.status, "disputed"))
      .orderBy(asc(disputes.id)),
    db
      .select({ marketId: markets.id, question: markets.question, closeAt: markets.closeAt, creator: creator.nickname })
      .from(markets)
      .innerJoin(creator, eq(creator.id, markets.creatorId))
      .where(
        and(
          eq(markets.status, "open"),
          lte(markets.closeAt, new Date(now.getTime() - NO_RESULT_DEADLINE_MS)),
          sql`not exists (select 1 from resolutions r where r.market_id = ${markets.id} and r.status in ('proposed', 'disputed'))`,
        ),
      )
      .orderBy(asc(markets.closeAt)),
    db
      .select({
        id: reports.id,
        marketId: reports.marketId,
        question: markets.question,
        hiddenAt: markets.hiddenAt,
        commentId: reports.commentId,
        commentBody: comments.body,
        reporter: reporter.nickname,
        reason: reports.reason,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .innerJoin(markets, eq(markets.id, reports.marketId))
      .innerJoin(reporter, eq(reporter.id, reports.reporterId))
      .leftJoin(comments, eq(comments.id, reports.commentId))
      .where(isNull(reports.handledAt))
      .orderBy(asc(reports.id)),
    db
      .select({
        id: profiles.id,
        nickname: profiles.nickname,
        firstName: profiles.firstName,
        role: profiles.role,
        suspendedAt: profiles.suspendedAt,
        canCreate: profiles.canCreate,
      })
      .from(profiles)
      .orderBy(asc(sql`lower(${profiles.nickname})`)),
  ]);
  return {
    disputes: disputed.map((d) => ({ ...d, reasons: reasons.filter((r) => r.resolutionId === d.resolutionId) })),
    overdue,
    reports: open.map(({ hiddenAt, ...r }) => ({ ...r, hidden: hiddenAt !== null })),
    members: members.map(({ suspendedAt, ...m }) => ({ ...m, suspended: suspendedAt !== null })),
  };
}

export interface LogRow {
  id: bigint;
  admin: string;
  kind: ActionKind;
  marketId: string | null;
  question: string | null;
  memberId: string | null;
  member: string | null;
  note: string | null;
  createdAt: Date;
}

/** The public log of admin actions, newest first. */
export async function getAdminLog(db: Db, limit = 100): Promise<LogRow[]> {
  const adminP = alias(profiles, "admin_p");
  const memberP = alias(profiles, "member_p");
  return db
    .select({
      id: adminActions.id,
      admin: adminP.nickname,
      kind: adminActions.kind,
      marketId: adminActions.marketId,
      question: markets.question,
      memberId: adminActions.memberId,
      member: memberP.nickname,
      note: adminActions.note,
      createdAt: adminActions.createdAt,
    })
    .from(adminActions)
    .innerJoin(adminP, eq(adminP.id, adminActions.adminId))
    .leftJoin(markets, eq(markets.id, adminActions.marketId))
    .leftJoin(memberP, eq(memberP.id, adminActions.memberId))
    .orderBy(desc(adminActions.id))
    .limit(limit);
}
