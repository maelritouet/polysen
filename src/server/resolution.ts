import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Side } from "@/core/amm";
import { resolvePayouts } from "@/core/settlement";
import type { Db, Tx } from "@/db/client";
import { disputes, ledger, markets, profiles, resolutions, trades } from "@/db/schema";
import { loadBook } from "./book";
import { UserError, uniqueViolation } from "./errors";
import { cancelMarket } from "./markets";

/** A proposed result pays out this long after it was proposed, unless disputed (PRD). */
export const DISPUTE_WINDOW_MS = 24 * 3_600_000;
/** A market still waiting for a tagged member's approval is cancelled after this long. */
export const APPROVAL_TIMEOUT_MS = 48 * 3_600_000;
/** With no result this long after the close, the admin resolves or cancels it (phase 5b). */
export const NO_RESULT_DEADLINE_MS = 48 * 3_600_000;

export type Outcome = Side | "CANCEL";

export interface NewResolution {
  marketId: string;
  outcome: Outcome;
  proof: string;
}

async function lockMarket(tx: Tx, marketId: string) {
  const [m] = await tx.select().from(markets).where(eq(markets.id, marketId)).for("update");
  if (!m) throw new UserError("Marché introuvable.");
  return m;
}

/** The creator proposes the result once betting has closed. It pays out after the dispute window. */
export async function proposeResolution(db: Db, memberId: string, input: NewResolution, now: Date = new Date()): Promise<void> {
  const proof = input.proof.trim();
  if (proof.length < 3) throw new UserError("Ajoute une preuve : un lien, un témoin, ce que tu as vu.");
  if (proof.length > 500) throw new UserError("La preuve fait 500 caractères maximum.");
  try {
    await db.transaction(async (tx) => {
      const m = await lockMarket(tx, input.marketId);
      if (m.creatorId !== memberId) throw new UserError("Seul le créateur du marché peut proposer le résultat.");
      if (m.status !== "open") throw new UserError("Ce marché n'attend pas de résultat.");
      if (m.closeAt > now) throw new UserError("Les paris sont encore ouverts : attends la fermeture.");
      const [live] = await tx
        .select({ id: resolutions.id })
        .from(resolutions)
        .where(and(eq(resolutions.marketId, m.id), inArray(resolutions.status, ["proposed", "disputed"])));
      if (live) throw new UserError("Un résultat est déjà proposé pour ce marché.");
      await tx.insert(resolutions).values({ marketId: m.id, proposedBy: memberId, outcome: input.outcome, proof, createdAt: now });
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) throw new UserError("Un résultat est déjà proposé pour ce marché.");
    throw err;
  }
}

/** A player says the proposed result is wrong: the payout waits for the admin. */
export async function disputeResolution(db: Db, memberId: string, resolutionId: bigint, text: string, now: Date = new Date()): Promise<string> {
  const reason = text.trim();
  if (reason.length < 3) throw new UserError("Dis en une phrase pourquoi le résultat est faux (ta raison).");
  if (reason.length > 300) throw new UserError("300 caractères maximum.");
  const [r0] = await db.select({ marketId: resolutions.marketId }).from(resolutions).where(eq(resolutions.id, resolutionId));
  if (!r0) throw new UserError("Résultat introuvable.");
  try {
    await db.transaction(async (tx) => {
      await lockMarket(tx, r0.marketId); // same lock as the payout job: a dispute and a payout can't cross
      const [r] = await tx.select().from(resolutions).where(eq(resolutions.id, resolutionId));
      if (r.status !== "proposed" && r.status !== "disputed") throw new UserError("Ce résultat est déjà réglé.");
      if (now.getTime() >= r.createdAt.getTime() + DISPUTE_WINDOW_MS) throw new UserError("Trop tard : le délai de 24 h pour contester est passé.");
      if (r.proposedBy === memberId) throw new UserError("Tu ne peux pas contester ton propre résultat.");
      const [played] = await tx
        .select({ id: trades.id })
        .from(trades)
        .where(and(eq(trades.marketId, r.marketId), eq(trades.memberId, memberId)))
        .limit(1);
      if (!played) throw new UserError("Seuls les joueurs de ce marché peuvent contester le résultat.");
      await tx.insert(disputes).values({ resolutionId, memberId, reason, createdAt: now });
      await tx.update(resolutions).set({ status: "disputed" }).where(eq(resolutions.id, resolutionId));
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) throw new UserError("Tu as déjà contesté ce résultat.");
    throw err;
  }
  return r0.marketId;
}

/**
 * Pays out a market inside the caller's transaction, which must hold the
 * market's row lock: core `resolvePayouts` (decision 007), players locked in
 * id order like a cancel.
 */
export async function payOut(tx: Tx, marketId: string, outcome: Side, now: Date): Promise<void> {
  const book = await loadBook(tx, marketId);
  if (!book) throw new Error(`Unknown market ${marketId}`);
  const players = [...new Set([...book.positions.keys(), book.creatorId])].sort();
  await tx.select({ id: profiles.id }).from(profiles).where(inArray(profiles.id, players)).orderBy(asc(profiles.id)).for("update");
  const rows = resolvePayouts(book, outcome)
    .filter((t) => t.amount !== 0n)
    .map((t) => ({ memberId: t.memberId, amount: t.amount, reason: t.reason, marketId, createdAt: now }));
  if (rows.length) await tx.insert(ledger).values(rows);
  await tx.update(markets).set({ status: "resolved", outcome, settledAt: now }).where(eq(markets.id, marketId));
}

/** Applies an outcome to a locked market: pay out, or cancel and refund. */
export async function settle(tx: Tx, marketId: string, outcome: Outcome, now: Date): Promise<void> {
  if (outcome === "CANCEL") await cancelMarket(tx, marketId, now);
  else await payOut(tx, marketId, outcome, now);
}

/**
 * The scheduled job (every 15 minutes in production). Safe to run twice, or
 * twice at once: each market is settled under its row lock, and only if it is
 * still waiting.
 *   1. pays out every undisputed result older than the dispute window;
 *   2. cancels markets that waited too long for a tagged member's approval.
 */
export async function runTick(db: Db, now: Date = new Date()): Promise<{ paid: string[]; cancelled: string[] }> {
  const dueBefore = new Date(now.getTime() - DISPUTE_WINDOW_MS);
  const due = await db
    .select({ id: resolutions.id, marketId: resolutions.marketId })
    .from(resolutions)
    .where(and(eq(resolutions.status, "proposed"), lte(resolutions.createdAt, dueBefore)));
  const paid: string[] = [];
  for (const d of due) {
    const done = await db.transaction(async (tx) => {
      const m = await lockMarket(tx, d.marketId);
      const [r] = await tx.select().from(resolutions).where(eq(resolutions.id, d.id));
      if (r.status !== "proposed" || m.status !== "open") return false; // another run, or a dispute, got there first
      await settle(tx, m.id, r.outcome, now);
      await tx.update(resolutions).set({ status: "accepted", decidedAt: now }).where(eq(resolutions.id, r.id));
      return true;
    });
    if (done) paid.push(d.marketId);
  }

  const staleBefore = new Date(now.getTime() - APPROVAL_TIMEOUT_MS);
  const stale = await db
    .select({ id: markets.id })
    .from(markets)
    .where(and(eq(markets.status, "pending_approval"), lte(markets.createdAt, staleBefore)));
  const cancelled: string[] = [];
  for (const s of stale) {
    const done = await db.transaction(async (tx) => {
      const m = await lockMarket(tx, s.id);
      if (m.status !== "pending_approval") return false;
      await cancelMarket(tx, m.id, now);
      return true;
    });
    if (done) cancelled.push(s.id);
  }
  return { paid, cancelled };
}

export interface ResolutionState {
  id: bigint;
  outcome: Outcome;
  proof: string;
  status: "proposed" | "disputed" | "accepted" | "overturned";
  createdAt: Date;
  /** When it pays out if nobody disputes. */
  paysAt: Date;
  disputes: number;
}

/** The market's latest proposed result, with its dispute count. */
export async function getResolution(db: Db, marketId: string): Promise<ResolutionState | null> {
  const [r] = await db
    .select({
      id: resolutions.id,
      outcome: resolutions.outcome,
      proof: resolutions.proof,
      status: resolutions.status,
      createdAt: resolutions.createdAt,
      // Qualified by hand: inside a subquery Drizzle would print a bare "id", which binds to disputes.id.
      disputes: sql<number>`(select count(*)::int from disputes d where d.resolution_id = resolutions.id)`,
    })
    .from(resolutions)
    .where(eq(resolutions.marketId, marketId))
    .orderBy(desc(resolutions.id))
    .limit(1);
  return r ? { ...r, paysAt: new Date(r.createdAt.getTime() + DISPUTE_WINDOW_MS) } : null;
}
