DROP INDEX "product_slug_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "product_shop_slug_unique" ON "product" USING btree ("shop_id","slug");