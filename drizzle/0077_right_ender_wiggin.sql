CREATE TYPE "public"."return_request_status" AS ENUM('requested', 'authorized', 'awaiting_shipment', 'in_transit', 'received', 'refund_pending', 'refunded', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."return_request_type" AS ENUM('withdrawal', 'defective');--> statement-breakpoint
CREATE TABLE "guest_order_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_order_id" uuid NOT NULL,
	"email_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_order_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'initiating' NOT NULL,
	"provider_payment_id" text,
	"checkout_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempt_status_valid" CHECK ("payment_attempt"."status" IN ('initiating', 'completed', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "return_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_order_id" uuid NOT NULL,
	"buyer_user_id" text NOT NULL,
	"type" "return_request_type" NOT NULL,
	"status" "return_request_status" DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"return_shipping_payer" text NOT NULL,
	"policy_version" text DEFAULT 'eu-baseline-2026-01' NOT NULL,
	"request_deadline" timestamp NOT NULL,
	"return_deadline" timestamp NOT NULL,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"outbound_shipping_refund_cents" integer DEFAULT 0 NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"label_url" text,
	"rejection_reason" text,
	"received_at" timestamp,
	"refund_attempted_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "return_request_shipping_payer_valid" CHECK ("return_request"."return_shipping_payer" IN ('buyer', 'seller')),
	CONSTRAINT "return_request_refund_non_negative" CHECK ("return_request"."refund_cents" >= 0),
	CONSTRAINT "return_request_outbound_refund_non_negative" CHECK ("return_request"."outbound_shipping_refund_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_request_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_request_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"refund_cents" integer NOT NULL,
	CONSTRAINT "return_request_item_quantity_positive" CHECK ("return_request_item"."quantity" > 0),
	CONSTRAINT "return_request_item_refund_non_negative" CHECK ("return_request_item"."refund_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_request_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_request_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "recipient_email" text;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "return_policy_snapshot" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "return_window_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "checkout_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "buyer_email" text;--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "buyer_email_hash" text;--> statement-breakpoint
ALTER TABLE "platform_order" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "return_policy" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "standard_shipping_cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "shop_order" SET "standard_shipping_cost_cents" = "shipping_cost_cents";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_order_access" ADD CONSTRAINT "guest_order_access_platform_order_id_platform_order_id_fk" FOREIGN KEY ("platform_order_id") REFERENCES "public"."platform_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_platform_order_id_platform_order_id_fk" FOREIGN KEY ("platform_order_id") REFERENCES "public"."platform_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_shop_order_id_shop_order_id_fk" FOREIGN KEY ("shop_order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_item" ADD CONSTRAINT "return_request_item_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_item" ADD CONSTRAINT "return_request_item_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_message" ADD CONSTRAINT "return_request_message_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request_message" ADD CONSTRAINT "return_request_message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guest_order_access_order_unique" ON "guest_order_access" USING btree ("platform_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_order_access_token_hash_unique" ON "guest_order_access" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "guest_order_access_email_hash_idx" ON "guest_order_access" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "guest_order_access_expires_at_idx" ON "guest_order_access" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "payment_attempt_order_idx" ON "payment_attempt" USING btree ("platform_order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempt_idempotency_key_unique" ON "payment_attempt" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "return_request_shop_order_idx" ON "return_request" USING btree ("shop_order_id");--> statement-breakpoint
CREATE INDEX "return_request_buyer_idx" ON "return_request" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "return_request_status_idx" ON "return_request" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "return_request_item_unique" ON "return_request_item" USING btree ("return_request_id","order_item_id");--> statement-breakpoint
CREATE INDEX "return_request_item_request_idx" ON "return_request_item" USING btree ("return_request_id");--> statement-breakpoint
CREATE INDEX "return_request_message_request_idx" ON "return_request_message" USING btree ("return_request_id");--> statement-breakpoint
CREATE INDEX "platform_order_buyer_email_hash_idx" ON "platform_order" USING btree ("buyer_email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_order_checkout_attempt_id_unique" ON "platform_order" USING btree ("checkout_attempt_id");--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_return_policy_valid" CHECK ("order_item"."return_policy_snapshot" IN ('standard', 'personalized', 'perishable', 'hygiene_sealed'));--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_return_window_positive" CHECK ("order_item"."return_window_days" > 0);--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_return_policy_valid" CHECK ("product"."return_policy" IN ('standard', 'personalized', 'perishable', 'hygiene_sealed'));