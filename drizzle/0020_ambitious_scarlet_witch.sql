CREATE TABLE "dispute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_order_id" uuid NOT NULL,
	"buyer_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"refund_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_shop_order_id_shop_order_id_fk" FOREIGN KEY ("shop_order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_message" ADD CONSTRAINT "dispute_message_dispute_id_dispute_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."dispute"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_message" ADD CONSTRAINT "dispute_message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_status_idx" ON "dispute" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispute_buyer_user_id_idx" ON "dispute" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_shop_order_id_unique" ON "dispute" USING btree ("shop_order_id");--> statement-breakpoint
CREATE INDEX "dispute_message_dispute_id_idx" ON "dispute_message" USING btree ("dispute_id");