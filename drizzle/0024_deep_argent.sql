CREATE TABLE "shipping_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_order_id" uuid NOT NULL,
	"carrier" text NOT NULL,
	"tracking_number" text,
	"label_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipping_label" ADD CONSTRAINT "shipping_label_shop_order_id_shop_order_id_fk" FOREIGN KEY ("shop_order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_label_shop_order_id_idx" ON "shipping_label" USING btree ("shop_order_id");
