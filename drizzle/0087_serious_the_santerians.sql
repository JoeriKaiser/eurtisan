CREATE TYPE "public"."listing_report_reason" AS ENUM('counterfeit', 'unsafe', 'illegal_goods', 'fraud', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_report_status" AS ENUM('open', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TABLE "product_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" "listing_report_reason" NOT NULL,
	"details" text,
	"status" "listing_report_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reason" "listing_report_reason" NOT NULL,
	"details" text,
	"status" "listing_report_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_report" ADD CONSTRAINT "product_report_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_report" ADD CONSTRAINT "product_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_report" ADD CONSTRAINT "product_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_report" ADD CONSTRAINT "shop_report_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_report" ADD CONSTRAINT "shop_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_report" ADD CONSTRAINT "shop_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_report_product_reporter_unique" ON "product_report" USING btree ("product_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "product_report_product_id_idx" ON "product_report" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_report_status_idx" ON "product_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_report_created_at_idx" ON "product_report" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_report_shop_reporter_unique" ON "shop_report" USING btree ("shop_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "shop_report_shop_id_idx" ON "shop_report" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "shop_report_status_idx" ON "shop_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shop_report_created_at_idx" ON "shop_report" USING btree ("created_at");