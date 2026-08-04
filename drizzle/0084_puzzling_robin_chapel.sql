CREATE TABLE "user_notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "group_key" text;--> statement-breakpoint
UPDATE "notification"
SET "group_key" = 'daily:' || "type"::text || ':' || to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "type" IN ('low_stock', 'review_received') AND "group_key" IS NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_preference_user_type_idx" ON "user_notification_preference" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "user_notification_preference_user_idx" ON "user_notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_group_created_at_idx" ON "notification" USING btree ("user_id","group_key","created_at");