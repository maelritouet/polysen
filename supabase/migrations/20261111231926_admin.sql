CREATE TYPE "public"."admin_action_kind" AS ENUM('resolve', 'cancel', 'restore_market', 'delete_comment', 'dismiss_report', 'suspend', 'unsuspend', 'revoke_create', 'restore_create');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"kind" "admin_action_kind" NOT NULL,
	"market_id" uuid,
	"comment_id" bigint,
	"member_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_actions_note_len" CHECK (char_length("admin_actions"."note") <= 300)
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"comment_id" bigint,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	CONSTRAINT "reports_reason_len" CHECK (char_length("reports"."reason") between 3 and 300)
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_profiles_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_created_idx" ON "admin_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("handled_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_once_idx" ON "reports" USING btree ("reporter_id","market_id",coalesce("comment_id", 0));