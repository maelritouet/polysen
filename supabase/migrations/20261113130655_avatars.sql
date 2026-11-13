CREATE TABLE "avatars" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatars_image_size" CHECK (octet_length(image) <= 200000)
);
--> statement-breakpoint
ALTER TABLE "avatars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_member_id_profiles_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;