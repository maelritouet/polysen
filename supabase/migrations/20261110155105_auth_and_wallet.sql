CREATE TYPE "public"."ledger_reason" AS ENUM('grant', 'drop', 'bet', 'sale', 'payout', 'refund', 'creator_bonus', 'seed', 'seed_return');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TABLE "daily_claims" (
	"member_id" uuid NOT NULL,
	"day" date NOT NULL,
	"streak" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_claims_member_id_day_pk" PRIMARY KEY("member_id","day"),
	CONSTRAINT "daily_claims_streak_positive" CHECK ("daily_claims"."streak" >= 1)
);
--> statement-breakpoint
ALTER TABLE "daily_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"market_id" uuid,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "ledger_amount_not_zero" CHECK ("ledger"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"nickname" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"invite_code" text NOT NULL,
	"invited_by" uuid,
	"can_create" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_invite_code_unique" UNIQUE("invite_code"),
	CONSTRAINT "profiles_first_name_len" CHECK (char_length("profiles"."first_name") between 1 and 40),
	CONSTRAINT "profiles_nickname_len" CHECK (char_length("profiles"."nickname") between 2 and 24)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_claims" ADD CONSTRAINT "daily_claims_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_member_idx" ON "ledger" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "ledger_market_idx" ON "ledger" USING btree ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_nickname_lower_idx" ON "profiles" USING btree (lower("nickname"));