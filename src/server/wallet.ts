import { and, desc, eq, sql } from "drizzle-orm";
import { dailyDropAmount, type LedgerReason } from "@/core/ledger";
import type { Coins } from "@/core/money";
import { parisDate, previousDay } from "@/core/time";
import type { Db } from "@/db/client";
import { dailyClaims, ledger, profiles } from "@/db/schema";
import { UserError } from "./errors";

/** A member's balance: the sum of their ledger rows, in hundredths. */
export async function getBalance(db: Db, memberId: string): Promise<Coins> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledger.amount}), 0)` })
    .from(ledger)
    .where(eq(ledger.memberId, memberId));
  return BigInt(row.total);
}

export interface HistoryRow {
  id: bigint;
  amount: Coins;
  reason: LedgerReason;
  marketId: string | null;
  createdAt: Date;
}

export async function getHistory(db: Db, memberId: string, limit = 100): Promise<HistoryRow[]> {
  return db
    .select({
      id: ledger.id,
      amount: ledger.amount,
      reason: ledger.reason,
      marketId: ledger.marketId,
      createdAt: ledger.createdAt,
    })
    .from(ledger)
    .where(eq(ledger.memberId, memberId))
    .orderBy(desc(ledger.id))
    .limit(limit);
}

/**
 * Claims today's drop (Paris day). One claim per day: the primary key on
 * (member, day) refuses a second one, even from two tabs at once.
 * The streak continues if yesterday was claimed, otherwise restarts at 1.
 */
export async function claimDailyDrop(db: Db, memberId: string, now: Date = new Date()): Promise<{ amount: Coins; streak: number }> {
  const today = parisDate(now);
  const yesterday = previousDay(today);

  return db.transaction(async (tx) => {
    // Lock the member: concurrent coin actions for one member run one at a time.
    const [member] = await tx
      .select({ suspendedAt: profiles.suspendedAt })
      .from(profiles)
      .where(eq(profiles.id, memberId))
      .for("update");
    if (!member) throw new UserError("Profil introuvable.");
    if (member.suspendedAt) throw new UserError("Ton compte est suspendu.");

    const [prev] = await tx
      .select({ streak: dailyClaims.streak })
      .from(dailyClaims)
      .where(and(eq(dailyClaims.memberId, memberId), eq(dailyClaims.day, yesterday)));
    const streak = prev ? prev.streak + 1 : 1;

    const inserted = await tx
      .insert(dailyClaims)
      .values({ memberId, day: today, streak })
      .onConflictDoNothing()
      .returning({ streak: dailyClaims.streak });
    if (!inserted.length) throw new UserError("Tu as déjà récupéré ta récompense aujourd'hui. Reviens demain !");

    const amount = dailyDropAmount(streak);
    await tx.insert(ledger).values({ memberId, amount, reason: "drop" });
    return { amount, streak };
  });
}

/** True if the member has already claimed today's drop. */
export async function hasClaimedToday(db: Db, memberId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ day: dailyClaims.day })
    .from(dailyClaims)
    .where(and(eq(dailyClaims.memberId, memberId), eq(dailyClaims.day, parisDate(now))));
  return Boolean(row);
}
