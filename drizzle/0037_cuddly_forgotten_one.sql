-- SAFETY: Confirmed `todos` was empty legacy scaffold before deploy. Do not run if that table still has data.
DROP TABLE "todos" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_socials_shop_platform_unique" ON "shop_socials" USING btree ("shop_id","platform");
