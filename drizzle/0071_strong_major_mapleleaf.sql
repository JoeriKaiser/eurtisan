CREATE TABLE "financial_total_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_name" text NOT NULL,
	"stored_cents" integer NOT NULL,
	"computed_cents" integer NOT NULL,
	"diff_cents" integer NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "inventory_reservation_product_order_unique";--> statement-breakpoint
DROP INDEX "inventory_reservation_product_cart_unique";--> statement-breakpoint
DROP INDEX "product_variant_sku_unique";--> statement-breakpoint
ALTER TABLE "payout" ALTER COLUMN "shop_order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "token_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "refund_pending_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "last_refund_attempted_at" timestamp;--> statement-breakpoint
CREATE INDEX "financial_total_audit_entity_idx" ON "financial_total_audit" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "financial_total_audit_created_at_idx" ON "financial_total_audit" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "meilisearch_sync_queue" ADD CONSTRAINT "meilisearch_sync_queue_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("providerId","accountId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "product_option_value_option_value_unique" ON "product_option_value" USING btree ("option_id","value");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_product_name_unique" ON "product_variant" USING btree ("product_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservation_product_order_unique" ON "inventory_reservation" USING btree ("product_id","platform_order_id") WHERE "inventory_reservation"."platform_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservation_product_cart_unique" ON "inventory_reservation" USING btree ("product_id","cart_id") WHERE "inventory_reservation"."cart_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_sku_unique" ON "product_variant" USING btree ("sku") WHERE "product_variant"."sku" is not null;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_quantity_positive" CHECK ("cart_item"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_owner_check" CHECK (
        ("inventory_reservation"."platform_order_id" IS NOT NULL AND "inventory_reservation"."cart_id" IS NULL)
        OR
        ("inventory_reservation"."platform_order_id" IS NULL AND "inventory_reservation"."cart_id" IS NOT NULL)
      );--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_quantity_positive" CHECK ("order_item"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "platform_order" ADD CONSTRAINT "platform_order_refunded_cents_not_over_total" CHECK ("platform_order"."refunded_cents" <= "platform_order"."total_cents");--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_stock_count_non_negative" CHECK ("product_variant"."stock_count" >= 0);--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_refunded_cents_not_over_total" CHECK ("shop_order"."refunded_cents" <= "shop_order"."subtotal_cents" + "shop_order"."shipping_cost_cents");--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_refund_pending_cents_non_negative" CHECK ("shop_order"."refund_pending_cents" >= 0);