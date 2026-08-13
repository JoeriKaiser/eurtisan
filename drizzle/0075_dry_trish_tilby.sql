ALTER TABLE "dispute" ADD COLUMN "opened_from_order_status" "order_status";--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "tracking_status" text;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "last_tracking_event_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "processing_time_max_business_days" integer;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "transit_time_min_business_days" integer;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "transit_time_max_business_days" integer;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "fulfillment_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "earliest_delivery_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "delivery_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "shipped_at" timestamp;--> statement-breakpoint
-- Existing disputes could only be opened after delivery, so preserve their
-- established close-resolution semantics during the nullable rollout.
UPDATE "dispute"
SET "opened_from_order_status" = 'delivered'
WHERE "opened_from_order_status" IS NULL;--> statement-breakpoint
-- Existing paid/fulfilled orders predate the authoritative payment timestamp.
-- created_at is a conservative, deterministic fallback for the 30-day legacy
-- non-delivery threshold; new orders receive the provider-confirmed timestamp.
UPDATE "platform_order"
SET "paid_at" = "created_at"
WHERE "paid_at" IS NULL
  AND "status" IN ('paid', 'processing', 'shipped', 'delivered', 'completed', 'refunded', 'disputed');