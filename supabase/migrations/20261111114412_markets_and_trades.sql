CREATE TYPE "public"."market_status" AS ENUM('pending_approval', 'open', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tag_status" AS ENUM('pending', 'approved', 'refused');--> statement-breakpoint
CREATE TYPE "public"."trade_kind" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('YES', 'NO');--> statement-breakpoint
CREATE TABLE "market_tags" (
	"market_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "tag_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "market_tags_market_id_member_id_pk" PRIMARY KEY("market_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "market_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"question" text NOT NULL,
	"criteria" text NOT NULL,
	"close_at" timestamp with time zone NOT NULL,
	"status" "market_status" NOT NULL,
	"seed" bigint NOT NULL,
	"pool_yes" numeric(32, 12) NOT NULL,
	"pool_no" numeric(32, 12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "markets_question_len" CHECK (char_length("markets"."question") between 5 and 200),
	CONSTRAINT "markets_criteria_len" CHECK (char_length("markets"."criteria") between 3 and 300),
	CONSTRAINT "markets_seed_positive" CHECK ("markets"."seed" > 0),
	CONSTRAINT "markets_pool_positive" CHECK ("markets"."pool_yes" > 0 and "markets"."pool_no" > 0),
	CONSTRAINT "markets_close_after_creation" CHECK ("markets"."close_at" > "markets"."created_at")
);
--> statement-breakpoint
ALTER TABLE "markets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trades" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"market_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"kind" "trade_kind" NOT NULL,
	"coins" bigint NOT NULL,
	"shares" numeric(32, 12) NOT NULL,
	"prob_before" numeric(13, 12) NOT NULL,
	"prob_after" numeric(13, 12) NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "trades_coins_positive" CHECK ("trades"."coins" > 0),
	CONSTRAINT "trades_shares_positive" CHECK ("trades"."shares" > 0)
);
--> statement-breakpoint
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "market_tags" ADD CONSTRAINT "market_tags_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_tags" ADD CONSTRAINT "market_tags_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_tags_member_idx" ON "market_tags" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "markets_creator_created_idx" ON "markets" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE INDEX "markets_status_close_idx" ON "markets" USING btree ("status","close_at");--> statement-breakpoint
CREATE INDEX "trades_market_idx" ON "trades" USING btree ("market_id","id");--> statement-breakpoint
CREATE INDEX "trades_member_idx" ON "trades" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE VIEW "public"."positions" WITH (security_invoker = true) AS (select market_id, member_id,
      coalesce(sum(case when side = 'YES' then (case when kind = 'buy' then shares else -shares end) end), 0) as yes,
      coalesce(sum(case when side = 'NO' then (case when kind = 'buy' then shares else -shares end) end), 0) as no,
      sum(case when kind = 'buy' then coins else -coins end)::bigint as invested
    from trades group by market_id, member_id);