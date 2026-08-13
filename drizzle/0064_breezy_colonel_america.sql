ALTER TYPE "public"."payout_status" ADD VALUE 'returned';--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "returned_at" timestamp;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "return_reason" text;