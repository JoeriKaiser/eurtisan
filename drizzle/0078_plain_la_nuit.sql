CREATE TYPE "public"."search_event_type" AS ENUM('search', 'click');--> statement-breakpoint
CREATE TABLE "search_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "search_event_type" NOT NULL,
	"normalized_query" text NOT NULL,
	"result_count" integer,
	"source" text,
	"locale" text,
	"clicked_product_id" text,
	"clicked_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_event_position_positive" CHECK ("search_event"."clicked_position" IS NULL OR "search_event"."clicked_position" > 0)
);
--> statement-breakpoint
ALTER TABLE "search_event" ADD CONSTRAINT "search_event_clicked_product_id_product_id_fk" FOREIGN KEY ("clicked_product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_event_created_at_idx" ON "search_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_event_type_created_at_idx" ON "search_event" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "search_event_query_idx" ON "search_event" USING btree ("normalized_query");--> statement-breakpoint
CREATE INDEX "search_event_zero_results_idx" ON "search_event" USING btree ("normalized_query") WHERE "search_event"."result_count" = 0;