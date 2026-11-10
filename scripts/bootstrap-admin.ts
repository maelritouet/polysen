/**
 * Creates the first member, the admin, who has no one to invite them.
 * Sign up in the app first, then run:
 *   pnpm bootstrap-admin <email> <first name> <nickname>
 * Refuses if an admin already exists.
 */
import { config } from "dotenv";
import { createDb } from "../src/db/client";
import { bootstrapAdmin } from "../src/server/members";

config({ path: ".env.local", quiet: true });

async function main() {
  const [email, firstName, nickname] = process.argv.slice(2);
  if (!email || !firstName || !nickname) {
    console.error("Usage: pnpm bootstrap-admin <email> <first name> <nickname>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, close } = createDb(url, { max: 1 });
  try {
    const p = await bootstrapAdmin(db, { email, firstName, nickname });
    console.log(`Admin created: ${p.firstName} (${p.nickname}). Invite code: ${p.inviteCode}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
