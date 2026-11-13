"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  adminDeleteComment,
  adminDismissReport,
  adminResolve,
  adminRestoreMarket,
  adminSetCanCreate,
  adminSetSuspended,
} from "@/server/admin";
import { isUserError } from "@/server/errors";
import { requireMember } from "@/server/session";

/**
 * Admin actions. Each checks the session (requireMember), and each server
 * function checks the admin role in the database before doing anything.
 */

export type FormState = { error?: string } | null;

const ID = /^\d{1,19}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run(fn: (adminId: string) => Promise<unknown>, paths: string[] = []): Promise<FormState> {
  const me = await requireMember();
  try {
    await fn(me.id);
  } catch (err) {
    if (isUserError(err)) return { error: err.message };
    throw err;
  }
  for (const p of ["/admin", "/journal", "/", ...paths]) revalidatePath(p);
  return null;
}

export async function resolveAction(marketId: string, outcome: string, note: string): Promise<FormState> {
  if (!UUID.test(marketId) || (outcome !== "YES" && outcome !== "NO" && outcome !== "CANCEL")) return { error: "Requête invalide." };
  return run((id) => adminResolve(db, id, marketId, outcome, note), [`/marches/${marketId}`]);
}

export async function restoreMarketAction(marketId: string): Promise<FormState> {
  if (!UUID.test(marketId)) return { error: "Requête invalide." };
  return run((id) => adminRestoreMarket(db, id, marketId), [`/marches/${marketId}`]);
}

export async function deleteCommentAdminAction(commentId: string): Promise<FormState> {
  if (!ID.test(commentId)) return { error: "Requête invalide." };
  return run((id) => adminDeleteComment(db, id, BigInt(commentId)));
}

export async function dismissReportAction(reportId: string): Promise<FormState> {
  if (!ID.test(reportId)) return { error: "Requête invalide." };
  return run((id) => adminDismissReport(db, id, BigInt(reportId)));
}

export async function setSuspendedAction(memberId: string, suspended: boolean): Promise<FormState> {
  if (!UUID.test(memberId)) return { error: "Requête invalide." };
  return run((id) => adminSetSuspended(db, id, memberId, suspended));
}

export async function setCanCreateAction(memberId: string, canCreate: boolean): Promise<FormState> {
  if (!UUID.test(memberId)) return { error: "Requête invalide." };
  return run((id) => adminSetCanCreate(db, id, memberId, canCreate));
}
