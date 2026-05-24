ALTER TABLE "order_item" ADD COLUMN "vat_rate_basis_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "vat_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "vat_rate_category" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "is_vat_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "vat_id" text;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "vat_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "shipping_vat_rate_basis_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "shipping_vat_amount_cents" integer DEFAULT 0 NOT NULL;