import { eq } from "drizzle-orm";
import { D, type Coins } from "@/core/money";
import type { MarketBook, Position } from "@/core/settlement";
import type { Db, Tx } from "@/db/client";
import { markets, positions } from "@/db/schema";

/**
 * Reads a market back as the core's MarketBook: its pool, seed, creator and
 * every member's position (summed from trades by the `positions` view).
 * Pools and shares are stored at scale 12, so this is exact, and
 * `checkBook` from the core holds on it. Returns null for an unknown market.
 */
export async function loadBook(db: Db | Tx, marketId: string): Promise<MarketBook | null> {
  const [m] = await db
    .select({ creatorId: markets.creatorId, seed: markets.seed, yes: markets.poolYes, no: markets.poolNo })
    .from(markets)
    .where(eq(markets.id, marketId));
  if (!m) return null;

  const rows = await db.select().from(positions).where(eq(positions.marketId, marketId));
  const byMember = new Map<string, Position>();
  for (const r of rows) {
    byMember.set(r.memberId, { yes: D(r.yes), no: D(r.no), invested: BigInt(r.invested) as Coins });
  }
  return { pool: { yes: D(m.yes), no: D(m.no) }, seed: m.seed, creatorId: m.creatorId, positions: byMember };
}
