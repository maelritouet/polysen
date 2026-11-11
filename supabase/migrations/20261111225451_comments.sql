CREATE TABLE "comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"market_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "comments_body_len" CHECK (char_length("comments"."body") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_market_idx" ON "comments" USING btree ("market_id","id");--> statement-breakpoint
CREATE INDEX "comments_member_created_idx" ON "comments" USING btree ("member_id","created_at");