ALTER TABLE "order_item" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "length_cm" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "width_cm" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "length_cm" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "width_cm" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_weight_grams_positive" CHECK ("product"."weight_grams" IS NULL OR "product"."weight_grams" > 0);--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_length_cm_positive" CHECK ("product"."length_cm" IS NULL OR "product"."length_cm" > 0);--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_width_cm_positive" CHECK ("product"."width_cm" IS NULL OR "product"."width_cm" > 0);--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_height_cm_positive" CHECK ("product"."height_cm" IS NULL OR "product"."height_cm" > 0);