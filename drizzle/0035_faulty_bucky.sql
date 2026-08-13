CREATE TYPE "public"."invoice_type" AS ENUM('platform_fee', 'customer');--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"type" "invoice_type" NOT NULL,
	"shop_order_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"vat_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"vat_amount_cents" integer DEFAULT 0 NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"billing_details" jsonb NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shop_order_id_shop_order_id_fk" FOREIGN KEY ("shop_order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_shop_order_id_idx" ON "invoices" USING btree ("shop_order_id");--> statement-breakpoint
CREATE INDEX "invoices_type_idx" ON "invoices" USING btree ("type");