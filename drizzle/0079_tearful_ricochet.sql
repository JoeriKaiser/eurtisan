CREATE TYPE "public"."review_report_reason" AS ENUM('not_authentic', 'offensive', 'spam', 'personal_data', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_report_status" AS ENUM('open', 'upheld', 'dismissed');--> statement-breakpoint
CREATE TABLE "review_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" "review_report_reason" NOT NULL,
	"details" text,
	"status" "review_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report" ADD CONSTRAINT "review_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_report_review_reporter_unique" ON "review_report" USING btree ("review_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "review_report_review_id_idx" ON "review_report" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_report_status_idx" ON "review_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_report_created_at_idx" ON "review_report" USING btree ("created_at");--> statement-breakpoint
-- Data migration, not schema.
--
-- Until this release, `reportReviewQuery` flipped a review to `flagged` on a
-- single click by any signed-in user. Those rows cannot be told apart from an
-- admin's decision by status alone, but they can by audit trail: an admin
-- moderation always emits `review.moderate`, and the auto-flag emitted nothing.
--
-- This matters because `flagged` now restricts visibility. Leaving the
-- stranger-flagged rows would retroactively restrict content whose author never
-- received the statement of reasons DSA Article 17 requires, so they return to
-- `approved` — the state they displayed in all along. Admin decisions are left
-- exactly as they are.
UPDATE "review" SET "moderation_status" = 'approved'
WHERE "moderation_status" = 'flagged'
  AND NOT EXISTS (
    SELECT 1 FROM "audit_log"
    WHERE "audit_log"."action" = 'review.moderate'
      AND "audit_log"."resource_type" = 'review'
      AND "audit_log"."resource_id" = "review"."id"::text
      AND "audit_log"."metadata"->>'status' = 'flagged'
  );
