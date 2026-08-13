ALTER TYPE "public"."notification_type" ADD VALUE 'seller_reply_received';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'seller_reply_moderated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'seller_reply_report_resolved';--> statement-breakpoint
CREATE TABLE "review_helpful_vote" (
	"review_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_helpful_vote_review_id_user_id_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "seller_reply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_reply_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_reply_id" uuid NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" "review_report_reason" NOT NULL,
	"details" text,
	"status" "review_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_helpful_vote" ADD CONSTRAINT "review_helpful_vote_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_vote" ADD CONSTRAINT "review_helpful_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reply" ADD CONSTRAINT "seller_reply_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reply" ADD CONSTRAINT "seller_reply_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reply_report" ADD CONSTRAINT "seller_reply_report_seller_reply_id_seller_reply_id_fk" FOREIGN KEY ("seller_reply_id") REFERENCES "public"."seller_reply"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reply_report" ADD CONSTRAINT "seller_reply_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reply_report" ADD CONSTRAINT "seller_reply_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_helpful_vote_user_id_idx" ON "review_helpful_vote" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_reply_review_unique" ON "seller_reply" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "seller_reply_author_user_id_idx" ON "seller_reply" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "seller_reply_moderation_status_created_at_idx" ON "seller_reply" USING btree ("moderation_status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_reply_report_reply_reporter_unique" ON "seller_reply_report" USING btree ("seller_reply_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "seller_reply_report_reply_id_idx" ON "seller_reply_report" USING btree ("seller_reply_id");--> statement-breakpoint
CREATE INDEX "seller_reply_report_status_idx" ON "seller_reply_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seller_reply_report_created_at_idx" ON "seller_reply_report" USING btree ("created_at");