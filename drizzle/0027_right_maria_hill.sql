CREATE INDEX "platform_order_mollie_payment_id_idx" ON "platform_order" USING btree ("mollie_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_order_mollie_payment_id_unique" ON "platform_order" USING btree ("mollie_payment_id");
