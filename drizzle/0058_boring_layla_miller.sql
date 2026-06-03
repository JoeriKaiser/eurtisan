CREATE TYPE "public"."moderation_status" AS ENUM('approved', 'flagged', 'hidden');--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "moderation_status" "moderation_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
CREATE INDEX "review_moderation_status_idx" ON "review" USING btree ("moderation_status");