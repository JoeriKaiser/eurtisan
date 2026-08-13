CREATE TYPE "public"."shop_status" AS ENUM('draft', 'pending_review', 'changes_requested', 'approved', 'active', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "shop_socials" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "banner_image" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "production_type" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "has_production_partner" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "languages" text[];--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "policies" jsonb;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "announcement" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "status" "shop_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "onboarding_step" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "resubmission_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "payment_connected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "payment_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_socials" ADD CONSTRAINT "shop_socials_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_socials_shop_id_idx" ON "shop_socials" USING btree ("shop_id");--> statement-breakpoint
ALTER TABLE "shop" ADD CONSTRAINT "shop_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_status_idx" ON "shop" USING btree ("status");