import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Side } from "@/core/amm";
import type { Db } from "@/db/client";
import { comments, markets, marketTags, positions, profiles } from "@/db/schema";
import { UserError } from "./errors";
import { getVisibleMarket } from "./markets";

export const MAX_COMMENT = 500;
/** A light brake on spam: the group is small, so a burst is never a conversation. */
export const COMMENTS_PER_MINUTE = 5;

export interface CommentRow {
  id: bigint;
  memberId: string;
  nickname: string;
  /** null once deleted: the thread keeps a "message deleted" line. */
  body: string | null;
  createdAt: Date;
  /** The side the author holds now (the bigger one if both), or null. */
  holding: Side | null;
}

async function assertVisible(db: Db, viewerId: string, marketId: string) {
  if (!(await getVisibleMarket(db, viewerId, marketId))) throw new UserError("Marché introuvable.");
}

/** Adds a comment to a market the member can see. Returns its id. */
export async function addComment(db: Db, memberId: string, marketId: string, text: string, now: Date = new Date()): Promise<bigint> {
  const body = text.trim();
  if (!body) throw new UserError("Ton message est vide.");
  if (body.length > MAX_COMMENT) throw new UserError(`${MAX_COMMENT} caractères maximum.`);
  await assertVisible(db, memberId, marketId);
  const since = new Date(now.getTime() - 60_000);
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.memberId, memberId), gt(comments.createdAt, since), sql`${comments.createdAt} <= ${now.toISOString()}::timestamptz`));
  if (recent.n >= COMMENTS_PER_MINUTE) throw new UserError("Doucement : attends une minute avant de reposter.");
  const [row] = await db.insert(comments).values({ marketId, memberId, body, createdAt: now }).returning({ id: comments.id });
  return row.id;
}

export async function deleteMyComment(db: Db, memberId: string, commentId: bigint): Promise<string> {
  const [c] = await db.select({ memberId: comments.memberId, marketId: comments.marketId }).from(comments).where(eq(comments.id, commentId));
  if (!c) throw new UserError("Message introuvable.");
  if (c.memberId !== memberId) throw new UserError("Ce message n'est pas le tien.");
  await db.update(comments).set({ deletedAt: new Date() }).where(and(eq(comments.id, commentId), isNull(comments.deletedAt)));
  return c.marketId;
}

export async function listComments(db: Db, viewerId: string, marketId: string, limit = 100): Promise<CommentRow[]> {
  await assertVisible(db, viewerId, marketId);
  const rows = await db
    .select({
      id: comments.id,
      memberId: comments.memberId,
      nickname: profiles.nickname,
      body: comments.body,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      yes: positions.yes,
      no: positions.no,
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.id, comments.memberId))
    .leftJoin(positions, and(eq(positions.marketId, comments.marketId), eq(positions.memberId, comments.memberId)))
    .where(eq(comments.marketId, marketId))
    .orderBy(desc(comments.id))
    .limit(limit);
  return rows.map((r) => {
    const yes = Number(r.yes ?? 0);
    const no = Number(r.no ?? 0);
    return {
      id: r.id,
      memberId: r.memberId,
      nickname: r.nickname,
      body: r.deletedAt ? null : r.body,
      createdAt: r.createdAt,
      holding: yes <= 0 && no <= 0 ? null : yes >= no ? "YES" : "NO",
    };
  });
}

export interface Insider {
  memberId: string;
  nickname: string;
  role: "creator" | "tagged";
  sides: Side[];
}

/**
 * People with inside knowledge who hold a position: the creator and anyone
 * named in the market. Shown publicly on the market page (PRD).
 */
export async function getInsiders(db: Db, marketId: string): Promise<Insider[]> {
  const rows = await db
    .select({
      memberId: positions.memberId,
      nickname: profiles.nickname,
      creator: sql<boolean>`${markets.creatorId} = ${positions.memberId}`,
      yes: positions.yes,
      no: positions.no,
    })
    .from(positions)
    .innerJoin(markets, eq(markets.id, positions.marketId))
    .innerJoin(profiles, eq(profiles.id, positions.memberId))
    .leftJoin(marketTags, and(eq(marketTags.marketId, positions.marketId), eq(marketTags.memberId, positions.memberId)))
    .where(
      and(
        eq(positions.marketId, marketId),
        or(eq(markets.creatorId, positions.memberId), sql`${marketTags.memberId} is not null`),
        or(gt(positions.yes, "0"), gt(positions.no, "0")),
      ),
    );
  return rows
    .map((r) => ({
      memberId: r.memberId,
      nickname: r.nickname,
      role: r.creator ? ("creator" as const) : ("tagged" as const),
      sides: [...(Number(r.yes) > 0 ? ["YES" as const] : []), ...(Number(r.no) > 0 ? ["NO" as const] : [])],
    }))
    .sort((a, b) => (a.role === b.role ? a.nickname.localeCompare(b.nickname) : a.role === "creator" ? -1 : 1));
}
