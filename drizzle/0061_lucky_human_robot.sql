ALTER TABLE "shipping_label" ADD COLUMN "external_parcel_id" text;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "shipping_rate_id" text;