CREATE TYPE "public"."product_report_reason" AS ENUM('illegal', 'ip', 'fraud', 'offensive', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'product_moderated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'product_report_resolved';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'shop_moderated';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'shop_report_resolved';
