ALTER TABLE "shop" ADD COLUMN IF NOT EXISTS "slug" text;
UPDATE "shop" SET "slug" = 'untitled-' || "id" WHERE "slug" IS NULL;
ALTER TABLE "shop" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "shop_slug_unique" ON "shop" USING btree ("slug");
