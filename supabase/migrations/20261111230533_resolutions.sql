CREATE TYPE "public"."resolution_outcome" AS ENUM('YES', 'NO', 'CANCEL');--> statement-breakpoint
CREATE TYPE "public"."resolution_status" AS ENUM('proposed', 'disputed', 'accepted', 'overturned');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"resolution_id" bigint NOT NULL,
	"member_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_reason_len" CHECK (char_length("disputes"."reason") between 3 and 300)
);
--> statement-breakpoint
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resolutions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"market_id" uuid NOT NULL,
	"proposed_by" uuid NOT NULL,
	"outcome" "resolution_outcome" NOT NULL,
	"proof" text NOT NULL,
	"status" "resolution_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "resolutions_proof_len" CHECK (char_length("resolutions"."proof") between 3 and 500)
);
--> statement-breakpoint
ALTER TABLE "resolutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "outcome" "trade_side";--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolution_id_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."resolutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_proposed_by_profiles_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_one_per_member_idx" ON "disputes" USING btree ("resolution_id","member_id");--> statement-breakpoint
CREATE INDEX "resolutions_status_created_idx" ON "resolutions" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resolutions_one_live_idx" ON "resolutions" USING btree ("market_id") WHERE status in ('proposed', 'disputed');--> statement-breakpoint
-- Markets settled before this migration: date them by their first settlement ledger row.
UPDATE "markets" SET "settled_at" = coalesce(
  (SELECT min("created_at") FROM "ledger" WHERE "ledger"."market_id" = "markets"."id" AND "reason" IN ('payout', 'refund', 'seed_return')),
  "created_at")
WHERE "status" IN ('resolved', 'cancelled') AND "settled_at" IS NULL;
