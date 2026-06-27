CREATE TYPE "public"."meilisearch_sync_action" AS ENUM('index', 'delete');--> statement-breakpoint
CREATE TYPE "public"."meilisearch_sync_queue_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shop_social_platform" AS ENUM('instagram', 'facebook', 'twitter', 'tiktok', 'pinterest', 'youtube', 'website');--> statement-breakpoint
ALTER TABLE "meilisearch_sync_queue" DROP CONSTRAINT "meilisearch_sync_queue_status_check";--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "rate_limit_key_idx";--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meilisearch_sync_queue" ALTER COLUMN "action" SET DATA TYPE "public"."meilisearch_sync_action" USING "action"::"public"."meilisearch_sync_action";--> statement-breakpoint
ALTER TABLE "meilisearch_sync_queue" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."meilisearch_sync_queue_status";--> statement-breakpoint
ALTER TABLE "meilisearch_sync_queue" ALTER COLUMN "status" SET DATA TYPE "public"."meilisearch_sync_queue_status" USING "status"::"public"."meilisearch_sync_queue_status";--> statement-breakpoint
ALTER TABLE "shop_socials" ALTER COLUMN "platform" SET DATA TYPE "public"."shop_social_platform" USING "platform"::"public"."shop_social_platform";--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_original_invoice_number_invoices_invoice_number_fk" FOREIGN KEY ("original_invoice_number") REFERENCES "public"."invoices"("invoice_number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_item_shop_order_id_product_id_idx" ON "order_item" USING btree ("shop_order_id","product_id");--> statement-breakpoint
CREATE INDEX "platform_order_user_id_status_created_at_idx" ON "platform_order" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "platform_order_status_created_at_idx" ON "platform_order" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "shop_order_shop_id_status_created_at_idx" ON "shop_order" USING btree ("shop_id","status","created_at");--> statement-breakpoint
CREATE INDEX "shop_order_status_created_at_idx" ON "shop_order" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "email_outbox" DROP COLUMN "recipient_email";--> statement-breakpoint
ALTER TABLE "shop" ADD CONSTRAINT "shop_onboarding_step_bounds" CHECK ("shop"."onboarding_step" BETWEEN 1 AND 8);