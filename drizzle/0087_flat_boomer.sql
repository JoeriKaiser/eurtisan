CREATE INDEX "inventory_reservation_cart_id_idx" ON "inventory_reservation" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "inventory_reservation_platform_order_id_idx" ON "inventory_reservation" USING btree ("platform_order_id");--> statement-breakpoint
CREATE INDEX "invoices_original_invoice_number_idx" ON "invoices" USING btree ("original_invoice_number");--> statement-breakpoint
CREATE INDEX "meilisearch_sync_queue_product_action_idx" ON "meilisearch_sync_queue" USING btree ("product_id","action");--> statement-breakpoint
CREATE INDEX "order_item_variant_id_idx" ON "order_item" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_catalog_browse_idx" ON "product" USING btree ("status","is_active","created_at");--> statement-breakpoint
CREATE INDEX "product_catalog_price_idx" ON "product" USING btree ("status","is_active","price_cents");