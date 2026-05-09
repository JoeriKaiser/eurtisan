ALTER TABLE "shop" ADD COLUMN "is_suspended" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "stock_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "product" SET "price_cents" = (CAST("price" AS numeric) * 100)::integer WHERE "price" IS NOT NULL AND "price" <> '' AND "price" ~ '^[0-9]+(\.[0-9]+)?$';
--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "price";
--> statement-breakpoint
CREATE INDEX "product_category_is_active_created_at_idx" ON "product" USING btree ("category_id","is_active","created_at");
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"url" text NOT NULL,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_image_product_id_sort_order_idx" ON "product_image" USING btree ("product_id","sort_order");
