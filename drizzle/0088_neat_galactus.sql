ALTER TABLE "shop" ADD COLUMN "processing_time_min_days" integer;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "processing_time_max_days" integer;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "ships_international" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "shop_processing_time_idx" ON "shop" USING btree ("processing_time_min_days","processing_time_max_days");
