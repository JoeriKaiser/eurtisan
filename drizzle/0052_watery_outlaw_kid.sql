ALTER TABLE "platform_order" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;