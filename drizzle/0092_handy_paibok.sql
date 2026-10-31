ALTER TYPE "public"."return_request_status" ADD VALUE 'disputed' BEFORE 'closed';--> statement-breakpoint
DROP INDEX "dispute_shop_order_id_unique";--> statement-breakpoint
ALTER TABLE "dispute" ADD COLUMN "return_request_id" uuid;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "diminished_value_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "net_refund_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "return_request" SET "net_refund_cents" = "refund_cents" WHERE "net_refund_cents" = 0 AND "refund_cents" > 0;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "diminished_value_reason" text;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "diminished_value_category" text;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "diminished_value_evidence_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "return_request_item" ADD COLUMN "restock_item" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_return_request_id_idx" ON "dispute" USING btree ("return_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_active_shop_order_idx" ON "dispute" USING btree ("shop_order_id") WHERE status = 'open';--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_diminished_value_non_negative" CHECK ("return_request"."diminished_value_cents" >= 0);--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_net_refund_non_negative" CHECK ("return_request"."net_refund_cents" >= 0);--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_diminished_value_bounds" CHECK ("return_request"."diminished_value_cents" <= "return_request"."refund_cents" - "return_request"."outbound_shipping_refund_cents");