ALTER TABLE "shop" ADD COLUMN "onboarding_listing_id" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "seller_terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "seller_terms_version" text;--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "moderation_stage" integer;--> statement-breakpoint
-- Preserve resumability for drafts created by the former eight-step wizard.
UPDATE "shop"
SET "onboarding_step" = CASE
  WHEN "onboarding_step" <= 3 THEN 1
  WHEN "onboarding_step" = 4 THEN 2
  WHEN "onboarding_step" IN (6, 7) THEN 3
  WHEN "onboarding_step" = 5 THEN 4
  ELSE 5
END
WHERE "status" IN ('draft', 'changes_requested');--> statement-breakpoint
-- Attach the oldest existing product as the onboarding listing for migrated shops.
UPDATE "shop" AS s
SET "onboarding_listing_id" = (
  SELECT p."id"
  FROM "product" AS p
  WHERE p."shop_id" = s."id"
  ORDER BY p."created_at" ASC
  LIMIT 1
)
WHERE s."onboarding_listing_id" IS NULL
  AND EXISTS (SELECT 1 FROM "product" AS p WHERE p."shop_id" = s."id");