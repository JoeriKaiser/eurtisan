DROP INDEX "product_shop_slug_unique";--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "price_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "stock_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "is_active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "product_image" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "shop" ALTER COLUMN "is_suspended" SET DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX "product_slug_unique" ON "product" USING btree ("slug");