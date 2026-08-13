CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
DROP INDEX "product_shop_slug_unique";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "status" "product_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
UPDATE "product" SET "status" = 'published', "published_at" = "created_at";--> statement-breakpoint
CREATE INDEX "product_status_idx" ON "product" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_published_at_idx" ON "product" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "product_shop_status_idx" ON "product" USING btree ("shop_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_shop_slug_published_unique" ON "product" USING btree ("shop_id","slug") WHERE "product"."status" = 'published';
