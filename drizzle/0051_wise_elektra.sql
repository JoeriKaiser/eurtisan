ALTER TABLE "inventory_reservation" ALTER COLUMN "platform_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD COLUMN "cart_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservation_product_cart_unique" ON "inventory_reservation" USING btree ("product_id","cart_id");