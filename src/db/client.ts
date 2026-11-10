import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Creates a database client. The app uses the singleton in ./index.ts;
 * tests create their own against the local Supabase database.
 */
export function createDb(url: string, options: { max?: number } = {}): { db: Db; close: () => Promise<void> } {
  // prepare: false is required by Supabase's transaction pooler.
  const client = postgres(url, { prepare: false, max: options.max ?? 10 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
