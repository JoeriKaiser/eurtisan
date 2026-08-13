CREATE TYPE "public"."email_preference_category" AS ENUM('seller_updates', 'marketing', 'platform_announcements');--> statement-breakpoint
CREATE TABLE "user_email_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" "email_preference_category" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
UPDATE "user" SET "unsubscribe_token" = encode(gen_random_bytes(32), 'hex') WHERE "unsubscribe_token" IS NULL;--> statement-breakpoint
ALTER TABLE "user_email_preference" ADD CONSTRAINT "user_email_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_preference_user_category_idx" ON "user_email_preference" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "user_email_preference_user_idx" ON "user_email_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_unsubscribe_token_idx" ON "user" USING btree ("unsubscribe_token");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_unsubscribe_token_unique" UNIQUE("unsubscribe_token");
