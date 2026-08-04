CREATE TYPE "public"."unit_price_basis" AS ENUM('weight', 'volume');--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "volume_ml" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "sold_by" "unit_price_basis";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "volume_ml" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "sold_by" "unit_price_basis";--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_volume_ml_positive" CHECK ("product"."volume_ml" IS NULL OR "product"."volume_ml" > 0);