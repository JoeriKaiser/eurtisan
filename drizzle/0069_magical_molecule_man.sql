CREATE TYPE "public"."email_outbox_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'suppressed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."email_send_log_status" AS ENUM('accepted', 'delivered', 'bounced', 'complained', 'failed', 'suppressed', 'skipped');--> statement-breakpoint
CREATE TABLE "brevo_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_header" text,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"idempotency_key" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_hash" text NOT NULL,
	"template" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"data" jsonb NOT NULL,
	"category" text DEFAULT 'transactional' NOT NULL,
	"status" "email_outbox_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"provider" text,
	"provider_message_id" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_id" uuid,
	"recipient_hash" text NOT NULL,
	"template" text NOT NULL,
	"category" text DEFAULT 'transactional' NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "email_send_log_status" NOT NULL,
	"status_detail" text,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_suppression" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_outbox_id_email_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brevo_webhook_event_created_at_idx" ON "brevo_webhook_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "brevo_webhook_event_processed_at_idx" ON "brevo_webhook_event" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "email_outbox_status_scheduled_idx" ON "email_outbox" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "email_outbox_next_retry_idx" ON "email_outbox" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "email_outbox_idempotency_idx" ON "email_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_outbox_recipient_hash_idx" ON "email_outbox" USING btree ("recipient_hash");--> statement-breakpoint
CREATE INDEX "email_outbox_user_id_idx" ON "email_outbox" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_send_log_outbox_idx" ON "email_send_log" USING btree ("outbox_id");--> statement-breakpoint
CREATE INDEX "email_send_log_recipient_hash_idx" ON "email_send_log" USING btree ("recipient_hash");--> statement-breakpoint
CREATE INDEX "email_send_log_provider_msg_idx" ON "email_send_log" USING btree ("provider","provider_message_id");--> statement-breakpoint
CREATE INDEX "email_send_log_created_at_idx" ON "email_send_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_suppression_expires_at_idx" ON "email_suppression" USING btree ("expires_at");