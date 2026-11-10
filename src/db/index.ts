import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only database client. The browser never talks to the database:
 * every read and write goes through server code (see CLAUDE.md).
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

// prepare: false is required by Supabase's transaction pooler.
const client = postgres(url, { prepare: false });
export const db = drizzle(client, { schema });
