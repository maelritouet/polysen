import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

/**
 * Migrations are written straight into supabase/migrations with Supabase's
 * timestamp naming, so `supabase start`, `supabase db reset`, CI and
 * production (`supabase db push`) all apply the same files.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  migrations: { prefix: "supabase" },
  schemaFilter: ["public"],
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
