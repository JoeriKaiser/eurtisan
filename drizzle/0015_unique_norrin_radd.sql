ALTER TABLE "platform_order" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "delivered_at" timestamp;