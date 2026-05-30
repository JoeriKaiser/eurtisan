ALTER TABLE "payout" ADD COLUMN "shop_order_id" uuid;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_shop_order_id_shop_order_id_fk" FOREIGN KEY ("shop_order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_shop_order_id_unique" ON "payout" USING btree ("shop_order_id");