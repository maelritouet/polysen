import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { runTick } from "@/server/resolution";

/**
 * The scheduled job: pays out results whose dispute window has passed and
 * cancels markets that waited too long for approval. Safe to call twice.
 * Only callers with the secret get in (Vercel Cron sends it as a Bearer token).
 */
function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header) return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

async function handle(request: Request): Promise<Response> {
  // Reading the request first also keeps this route out of prerendering.
  if (!authorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const result = await runTick(db);
  return Response.json({ paid: result.paid.length, cancelled: result.cancelled.length });
}

export const GET = handle;
export const POST = handle;
