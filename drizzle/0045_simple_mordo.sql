CREATE INDEX "dispute_created_at_idx" ON "dispute" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payout_created_at_idx" ON "payout" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_created_at_idx" ON "product" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "review_buyer_user_id_idx" ON "review" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "shop_created_at_idx" ON "shop" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "shop_order_created_at_idx" ON "shop_order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_created_at_idx" ON "user" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");