import "server-only";
import { createDb, type Db } from "./client";

/**
 * Server-only database client. The browser never talks to the database:
 * every read and write goes through server code (see CLAUDE.md).
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

export const db: Db = createDb(url).db;
