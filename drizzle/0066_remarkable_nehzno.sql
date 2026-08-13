CREATE TABLE "customer_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"customer_email_hash" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"customer_email_hash" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "owner_message_sender_role_check" CHECK ("owner_message"."sender_role" IN ('owner', 'buyer', 'system'))
);
--> statement-breakpoint
CREATE TABLE "owner_message_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"customer_user_id" text,
	"customer_email_hash" text NOT NULL,
	"subject" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_option" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_option_value" (
	"id" text PRIMARY KEY NOT NULL,
	"option_id" text NOT NULL,
	"value" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_option" (
	"variant_id" text NOT NULL,
	"option_value_id" text NOT NULL,
	CONSTRAINT "product_variant_option_variant_id_option_value_id_pk" PRIMARY KEY("variant_id","option_value_id")
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "low_stock_threshold" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "price_adjustment_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "scheduled_delete_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "tracking_history" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN "dispute_window_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_note" ADD CONSTRAINT "customer_note_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tag" ADD CONSTRAINT "customer_tag_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_message" ADD CONSTRAINT "owner_message_thread_id_owner_message_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."owner_message_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_message_thread" ADD CONSTRAINT "owner_message_thread_shop_id_shop_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_message_thread" ADD CONSTRAINT "owner_message_thread_customer_user_id_user_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option" ADD CONSTRAINT "product_option_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_value" ADD CONSTRAINT "product_option_value_option_id_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_option_value_id_product_option_value_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."product_option_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_note_shop_id_customer_email_hash_idx" ON "customer_note" USING btree ("shop_id","customer_email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tag_shop_customer_tag_unique" ON "customer_tag" USING btree ("shop_id","customer_email_hash","tag");--> statement-breakpoint
CREATE INDEX "owner_message_thread_id_idx" ON "owner_message" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "owner_message_thread_shop_id_customer_email_hash_idx" ON "owner_message_thread" USING btree ("shop_id","customer_email_hash");--> statement-breakpoint
CREATE INDEX "product_option_product_id_idx" ON "product_option" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_option_value_option_id_idx" ON "product_option_value" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "product_variant_option_variant_id_idx" ON "product_variant_option" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_variant_option_option_value_id_idx" ON "product_variant_option" USING btree ("option_value_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_sku_unique" ON "product_variant" USING btree ("sku");