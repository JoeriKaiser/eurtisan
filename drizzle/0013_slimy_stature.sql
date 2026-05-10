CREATE TABLE "inventory_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"platform_order_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_platform_order_id_platform_order_id_fk" FOREIGN KEY ("platform_order_id") REFERENCES "public"."platform_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_reservation_product_id_idx" ON "inventory_reservation" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_reservation_expires_at_idx" ON "inventory_reservation" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservation_product_order_unique" ON "inventory_reservation" USING btree ("product_id","platform_order_id");