-- SAFETY: Confirmed `todos` was empty legacy scaffold before deploy. Do not run if that table still has data.
ALTER TABLE "todos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "todos" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_socials_shop_platform_unique" ON "shop_socials" USING btree ("shop_id","platform");