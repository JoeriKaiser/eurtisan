ALTER TABLE "platform_order" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "platform_order" ALTER COLUMN "status" SET DEFAULT 'pending_payment'::text;--> statement-breakpoint
ALTER TABLE "shop_order" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "shop_order" ALTER COLUMN "status" SET DEFAULT 'pending_payment'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed');--> statement-breakpoint
UPDATE "public"."platform_order" SET "status" = 'pending_payment' WHERE "status" = 'pending';--> statement-breakpoint
UPDATE "public"."platform_order" SET "status" = 'paid' WHERE "status" = 'confirmed';--> statement-breakpoint
UPDATE "public"."shop_order" SET "status" = 'pending_payment' WHERE "status" = 'pending';--> statement-breakpoint
UPDATE "public"."shop_order" SET "status" = 'paid' WHERE "status" = 'confirmed';--> statement-breakpoint
ALTER TABLE "platform_order" ALTER COLUMN "status" SET DEFAULT 'pending_payment'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "platform_order" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "shop_order" ALTER COLUMN "status" SET DEFAULT 'pending_payment'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "shop_order" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "billing_address" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "platform_order" ALTER COLUMN "billing_address" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "mollie_payment_id" text;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "tracking_url" text;--> statement-breakpoint
CREATE INDEX "platform_order_status_idx" ON "platform_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shop_order_status_idx" ON "shop_order" USING btree ("status");
