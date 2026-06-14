CREATE TABLE "sendcloud_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_header" text,
	"tracking_number" text,
	"parcel_id" text,
	"status" text,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sendcloud_webhook_event_tracking_number_idx" ON "sendcloud_webhook_event" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "sendcloud_webhook_event_parcel_id_idx" ON "sendcloud_webhook_event" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "sendcloud_webhook_event_created_at_idx" ON "sendcloud_webhook_event" USING btree ("created_at");