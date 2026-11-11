import { and, asc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { displayPercent, newPool } from "@/core/amm";
import { canSpend, MARKET_SEED } from "@/core/ledger";
import { cancelRefunds } from "@/core/settlement";
import { parisDate } from "@/core/time";
import type { Db, Tx } from "@/db/client";
import { ledger, markets, marketTags, positions, profiles } from "@/db/schema";
import { D } from "@/core/money";
import { loadBook } from "./book";
import { UserError } from "./errors";
import { getBalance } from "./wallet";

/** Market rules (decision 008). */
export const MAX_MARKETS_PER_DAY = 3;
export const MAX_TAGS = 5;
const HOUR = 3_600_000;
export const MIN_CLOSE_DELAY_MS = HOUR;
export const MAX_CLOSE_MONTHS = 3;

/** The one-line content rules shown on the creation form (decision 008). */
export const CONTENT_RULES =
  "Un marché ne doit blesser personne : personne nommée sans son accord, aucun sujet sensible, aucun pari qu'on gagne en se mettant en danger.";

export interface NewMarket {
  question: string;
  /** "How we'll know": one line on how the result will be judged. */
  criteria: string;
  closeAt: Date;
  /** Members named in the market. Each must approve before anyone else sees it. */
  tagIds: string[];
  acceptedRules: boolean;
}

export type MarketStatus = (typeof markets.$inferSelect)["status"];

function addMonthsUtc(d: Date, months: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

/**
 * Creates a market: checks the rules, takes the 100-coin seed and opens the
 * pool at 50%. With tagged members it waits for their approval
 * (pending_approval) and stays hidden from everyone else.
 */
export async function createMarket(
  db: Db,
  creatorId: string,
  input: NewMarket,
  now: Date = new Date(),
): Promise<{ id: string; status: MarketStatus }> {
  if (!input.acceptedRules) throw new UserError("Accepte les règles pour créer ton marché.");
  const question = input.question.trim();
  const criteria = input.criteria.trim();
  if (question.replace(/[?\s]/g, "").length < 4 || question.length > 200) {
    throw new UserError("Ta question doit faire entre 5 et 200 caractères.");
  }
  if (criteria.length < 3 || criteria.length > 300) {
    throw new UserError("Explique en une ligne comment on saura le résultat (3 à 300 caractères).");
  }
  if (Number.isNaN(input.closeAt.getTime()) || input.closeAt.getTime() < now.getTime() + MIN_CLOSE_DELAY_MS) {
    throw new UserError("Le marché doit fermer dans 1 heure au moins.");
  }
  if (input.closeAt > addMonthsUtc(now, MAX_CLOSE_MONTHS)) {
    throw new UserError("Le marché doit fermer dans 3 mois au plus.");
  }
  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.includes(creatorId)) throw new UserError("Tu ne peux pas te nommer toi-même.");
  if (tagIds.length > MAX_TAGS) throw new UserError(`Tu peux nommer ${MAX_TAGS} personnes au plus.`);

  return db.transaction(async (tx) => {
    // Lock the creator: their coin actions run one at a time.
    const [creator] = await tx
      .select({ canCreate: profiles.canCreate, suspendedAt: profiles.suspendedAt })
      .from(profiles)
      .where(eq(profiles.id, creatorId))
      .for("update");
    if (!creator) throw new UserError("Profil introuvable.");
    if (creator.suspendedAt) throw new UserError("Ton compte est suspendu.");
    if (!creator.canCreate) throw new UserError("Tu ne peux plus créer de marchés cette saison.");

    if (tagIds.length) {
      const found = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(inArray(profiles.id, tagIds), sql`${profiles.suspendedAt} is null`));
      if (found.length !== tagIds.length) throw new UserError("Tu ne peux nommer que des membres.");
    }

    // At most 3 per Paris day. Look back 2 days, then compare Paris dates.
    const recent = await tx
      .select({ createdAt: markets.createdAt })
      .from(markets)
      .where(and(eq(markets.creatorId, creatorId), gt(markets.createdAt, new Date(now.getTime() - 48 * HOUR))));
    const today = parisDate(now);
    if (recent.filter((r) => parisDate(r.createdAt) === today).length >= MAX_MARKETS_PER_DAY) {
      throw new UserError(`Tu as déjà créé ${MAX_MARKETS_PER_DAY} marchés aujourd'hui. Reviens demain !`);
    }

    if (!canSpend(await getBalance(tx, creatorId), MARKET_SEED)) {
      throw new UserError("Il te faut 100 pièces pour créer un marché.");
    }

    const pool = newPool(MARKET_SEED);
    const status: MarketStatus = tagIds.length ? "pending_approval" : "open";
    const [m] = await tx
      .insert(markets)
      .values({
        creatorId,
        question,
        criteria,
        closeAt: input.closeAt,
        status,
        seed: MARKET_SEED,
        poolYes: pool.yes.toFixed(12),
        poolNo: pool.no.toFixed(12),
        createdAt: now,
      })
      .returning({ id: markets.id });
    await tx.insert(ledger).values({ memberId: creatorId, amount: -MARKET_SEED, reason: "seed", marketId: m.id });
    if (tagIds.length) await tx.insert(marketTags).values(tagIds.map((memberId) => ({ marketId: m.id, memberId })));
    return { id: m.id, status };
  });
}

/**
 * A tagged member approves or refuses. Once every tag is approved the market
 * opens; a single refusal cancels it and refunds the creator's seed.
 */
export async function respondToTag(db: Db, memberId: string, marketId: string, approve: boolean, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [m] = await tx.select({ status: markets.status }).from(markets).where(eq(markets.id, marketId)).for("update");
    const [tag] = await tx
      .select({ status: marketTags.status })
      .from(marketTags)
      .where(and(eq(marketTags.marketId, marketId), eq(marketTags.memberId, memberId)));
    if (!m || !tag) throw new UserError("Tu n'es pas nommé dans ce marché.");
    if (m.status !== "pending_approval" || tag.status !== "pending") throw new UserError("Tu as déjà répondu.");

    await tx
      .update(marketTags)
      .set({ status: approve ? "approved" : "refused", respondedAt: now })
      .where(and(eq(marketTags.marketId, marketId), eq(marketTags.memberId, memberId)));

    if (!approve) {
      await cancelMarket(tx, marketId);
      return;
    }
    const [waiting] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(marketTags)
      .where(and(eq(marketTags.marketId, marketId), ne(marketTags.status, "approved")));
    if (waiting.n === 0) await tx.update(markets).set({ status: "open" }).where(eq(markets.id, marketId));
  });
}

/**
 * A tagged member removes a market they're named in, at any time before it
 * is settled: it is cancelled, everyone is refunded, and it disappears for
 * everyone else (their tag becomes refused).
 */
export async function removeMyMarket(db: Db, memberId: string, marketId: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [m] = await tx.select({ status: markets.status }).from(markets).where(eq(markets.id, marketId)).for("update");
    const [tag] = m
      ? await tx
          .select({ status: marketTags.status })
          .from(marketTags)
          .where(and(eq(marketTags.marketId, marketId), eq(marketTags.memberId, memberId)))
      : [];
    if (!m || !tag) throw new UserError("Seule une personne nommée peut retirer ce marché.");
    if (m.status !== "open" && m.status !== "pending_approval") throw new UserError("Ce marché est déjà terminé.");

    await tx
      .update(marketTags)
      .set({ status: "refused", respondedAt: now })
      .where(and(eq(marketTags.marketId, marketId), eq(marketTags.memberId, memberId)));
    await cancelMarket(tx, marketId);
  });
}

/**
 * Cancels a market inside the caller's transaction, which must already hold
 * the market's row lock: every player gets back what they put in and the
 * creator their seed (core `cancelRefunds`, decision 004).
 * Players are locked in id order, the same order trading uses after the
 * market lock, so two cancels or a cancel and a bet can't deadlock.
 */
export async function cancelMarket(tx: Tx, marketId: string): Promise<void> {
  const book = await loadBook(tx, marketId);
  if (!book) throw new Error(`Unknown market ${marketId}`);
  const players = [...book.positions.keys()].sort();
  const balances = new Map<string, bigint>();
  if (players.length) {
    await tx.select({ id: profiles.id }).from(profiles).where(inArray(profiles.id, players)).orderBy(asc(profiles.id)).for("update");
    for (const id of players) balances.set(id, await getBalance(tx, id));
  }
  const rows = cancelRefunds(book, balances)
    .filter((t) => t.amount !== 0n)
    .map((t) => ({ memberId: t.memberId, amount: t.amount, reason: t.reason, marketId }));
  if (rows.length) await tx.insert(ledger).values(rows);
  await tx.update(markets).set({ status: "cancelled" }).where(eq(markets.id, marketId));
}

export interface MarketSummary {
  /** When this was read (for "Ferme dans 3 h"). */
  asOf: Date;
  id: string;
  creatorId: string;
  question: string;
  criteria: string;
  closeAt: Date;
  status: MarketStatus;
  /** YES probability shown on screen, 1 to 99. */
  percent: number;
  createdAt: Date;
}

/**
 * Who can see a market: its creator and tagged members always; everyone
 * else only once every tag is approved. A refused or removed market stays
 * hidden from everyone else for good.
 */
function visibleTo(viewerId: string) {
  return or(
    eq(markets.creatorId, viewerId),
    sql`exists (select 1 from ${marketTags} where ${marketTags.marketId} = ${markets.id} and ${marketTags.memberId} = ${viewerId})`,
    sql`not exists (select 1 from ${marketTags} where ${marketTags.marketId} = ${markets.id} and ${marketTags.status} <> 'approved')`,
  );
}

const summaryColumns = {
  id: markets.id,
  creatorId: markets.creatorId,
  question: markets.question,
  criteria: markets.criteria,
  closeAt: markets.closeAt,
  status: markets.status,
  poolYes: markets.poolYes,
  poolNo: markets.poolNo,
  createdAt: markets.createdAt,
};

function toSummary(
  { poolYes, poolNo, ...r }: { poolYes: string; poolNo: string } & Omit<MarketSummary, "percent" | "asOf">,
  asOf: Date,
): MarketSummary {
  return { ...r, asOf, percent: displayPercent({ yes: D(poolYes), no: D(poolNo) }) };
}

/** Open (and, for those involved, pending) markets this member can see, closing soonest first. */
export async function listVisibleMarkets(db: Db, viewerId: string): Promise<MarketSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(markets)
    .where(and(inArray(markets.status, ["open", "pending_approval"]), visibleTo(viewerId)))
    .orderBy(asc(markets.closeAt));
  const now = new Date();
  return rows.map((r) => toSummary(r, now));
}

/** One market, or null if it doesn't exist or this member can't see it. */
export async function getVisibleMarket(db: Db, viewerId: string, marketId: string): Promise<MarketSummary | null> {
  const [row] = await db
    .select(summaryColumns)
    .from(markets)
    .where(and(eq(markets.id, marketId), visibleTo(viewerId)));
  return row ? toSummary(row, new Date()) : null;
}

/** The close-date bounds for the creation form: earliest allowed, and a default one day out. */
export function closeDateDefaults(now: Date = new Date()): { min: Date; suggested: Date } {
  return { min: new Date(now.getTime() + MIN_CLOSE_DELAY_MS + 60_000), suggested: new Date(now.getTime() + 24 * HOUR) };
}

export interface MarketDetails extends MarketSummary {
  /** True once close_at has passed: no more trades. */
  bettingClosed: boolean;
  creator: { id: string; nickname: string };
  tags: Array<{ memberId: string; nickname: string; status: "pending" | "approved" | "refused" }>;
  /** This viewer's shares and coins in (bets − sales). */
  mine: { yes: string; no: string; invested: bigint } | null;
}

/** Everything the market page shows, or null if this member can't see it. */
export async function getMarketDetails(
  db: Db,
  viewerId: string,
  marketId: string,
  now: Date = new Date(),
): Promise<MarketDetails | null> {
  const summary = await getVisibleMarket(db, viewerId, marketId);
  if (!summary) return null;
  const [creator] = await db.select({ id: profiles.id, nickname: profiles.nickname }).from(profiles).where(eq(profiles.id, summary.creatorId));
  const tags = await db
    .select({ memberId: marketTags.memberId, nickname: profiles.nickname, status: marketTags.status })
    .from(marketTags)
    .innerJoin(profiles, eq(profiles.id, marketTags.memberId))
    .where(eq(marketTags.marketId, marketId));
  const [p] = await db
    .select({ yes: positions.yes, no: positions.no, invested: positions.invested })
    .from(positions)
    .where(and(eq(positions.marketId, marketId), eq(positions.memberId, viewerId)));
  return { ...summary, bettingClosed: summary.closeAt <= now, asOf: now, creator, tags, mine: p ? { yes: p.yes, no: p.no, invested: BigInt(p.invested) } : null };
}
