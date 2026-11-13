import { eq } from "drizzle-orm";
import sharp from "sharp";
import type { Db } from "@/db/client";
import { avatars, profiles } from "@/db/schema";
import { UserError } from "./errors";

/** Profile photos (decision 018). */
export const PHOTO_SIZE = 256;
/** What we accept from the phone, before shrinking it. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Turns any uploaded image into a small square WebP. Re-encoding drops every
 * bit of metadata (EXIF, including the GPS position phones write), and
 * refuses anything that isn't really an image.
 */
export async function normalizePhoto(input: Uint8Array): Promise<Buffer> {
  if (input.byteLength === 0) throw new UserError("Choisis une photo.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new UserError("Photo trop lourde (8 Mo maximum).");
  try {
    return await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // follow the phone's orientation flag before it's dropped
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new UserError("Ce fichier n'est pas une image lisible.");
  }
}

export async function setPhoto(db: Db, memberId: string, input: Uint8Array, now: Date = new Date()): Promise<void> {
  const image = await normalizePhoto(input);
  await db
    .insert(avatars)
    .values({ memberId, image, updatedAt: now })
    .onConflictDoUpdate({ target: avatars.memberId, set: { image, updatedAt: now } });
}

export async function removePhoto(db: Pick<Db, "delete">, memberId: string): Promise<void> {
  await db.delete(avatars).where(eq(avatars.memberId, memberId));
}

/** The photo, or the member's nickname to draw initials from, or null for an unknown id. */
export async function getPhoto(
  db: Db,
  memberId: string,
): Promise<{ kind: "photo"; image: Buffer; updatedAt: Date } | { kind: "initials"; nickname: string } | null> {
  const [row] = await db
    .select({ nickname: profiles.nickname, image: avatars.image, updatedAt: avatars.updatedAt })
    .from(profiles)
    .leftJoin(avatars, eq(avatars.memberId, profiles.id))
    .where(eq(profiles.id, memberId));
  if (!row) return null;
  if (row.image && row.updatedAt) return { kind: "photo", image: row.image, updatedAt: row.updatedAt };
  return { kind: "initials", nickname: row.nickname };
}

/** When the member's photo last changed (ms), for cache-busting; 0 without a photo. */
export async function photoVersion(db: Db, memberId: string): Promise<number> {
  const [r] = await db.select({ at: avatars.updatedAt }).from(avatars).where(eq(avatars.memberId, memberId));
  return r ? r.at.getTime() : 0;
}

const PALETTE = ["#3be0a0", "#f5c451", "#ff6b6b", "#7cc4ff", "#c79bff", "#ff9f5a"];

/** A round badge with one or two letters, coloured from the nickname so it stays the same everywhere. */
export function initialsSvg(nickname: string): string {
  const letters = (nickname.match(/[\p{L}\p{N}]/gu) ?? ["?"]).slice(0, 2).join("").toUpperCase();
  let hash = 0;
  for (const ch of nickname) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  const colour = PALETTE[hash % PALETTE.length];
  const safe = letters.replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#16263d"/><text x="32" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="${colour}">${safe}</text></svg>`;
}
