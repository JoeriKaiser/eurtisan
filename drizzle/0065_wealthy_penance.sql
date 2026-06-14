ALTER TYPE "public"."invoice_type" ADD VALUE 'credit_note';--> statement-breakpoint
CREATE TABLE "invoice_number_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prefix" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_sequence_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "original_invoice_number" text;--> statement-breakpoint
CREATE INDEX "invoice_number_sequence_prefix_idx" ON "invoice_number_sequence" USING btree ("prefix");