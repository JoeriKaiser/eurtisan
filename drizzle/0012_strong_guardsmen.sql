CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."shipping_method" AS ENUM('standard', 'express');--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_order_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"quantity" integer NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_order_id" uuid NOT NULL,
	"shop_id" text NOT NULL,
	"shipping_method" "shipping_method" DEFAULT 'standard' NOT NULL,
	"shipping_cost_cents" integer DEFAULT 0 NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_shop_order_id_shop_order_id_fk" FOREIGN KEY ("shop_order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_order" ADD CONSTRAINT "platform_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_platform_order_id_platform_order_id_fk" FOREIGN KEY ("platform_order_id") REFERENCES "public"."platform_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_item_shop_order_id_idx" ON "order_item" USING btree ("shop_order_id");--> statement-breakpoint
CREATE INDEX "platform_order_user_id_idx" ON "platform_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_order_platform_order_id_idx" ON "shop_order" USING btree ("platform_order_id");--> statement-breakpoint
CREATE INDEX "shop_order_shop_id_idx" ON "shop_order" USING btree ("shop_id");