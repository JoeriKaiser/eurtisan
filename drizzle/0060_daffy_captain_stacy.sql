ALTER TYPE "public"."payout_status" ADD VALUE 'in_transit' BEFORE 'sent';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."payout_status" ADD VALUE 'reversed';--> statement-breakpoint
CREATE TABLE "payout_reconciliation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"event" text NOT NULL,
	"mollie_payment_id" text,
	"mollie_route_id" text,
	"amount_cents" integer,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "mollie_payment_id" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "mollie_route_id" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "executed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "reversed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "mollie_access_token" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "mollie_refresh_token" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "mollie_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout_reconciliation_log" ADD CONSTRAINT "payout_reconciliation_log_payout_id_payout_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payout_reconciliation_log_payout_id_idx" ON "payout_reconciliation_log" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "payout_reconciliation_log_created_at_idx" ON "payout_reconciliation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payout_mollie_payment_id_idx" ON "payout" USING btree ("mollie_payment_id");--> statement-breakpoint
CREATE INDEX "payout_mollie_route_id_idx" ON "payout" USING btree ("mollie_route_id");