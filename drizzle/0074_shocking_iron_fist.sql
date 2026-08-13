-- Add human-friendly order numbers to platform_order.
--
-- 1. Create the column as nullable so existing rows do not fail.
-- 2. Backfill every existing row with a unique 8-character order number drawn
--    from an alphabet that excludes visually ambiguous characters (0, O, 1, I).
-- 3. Enforce NOT NULL once all rows have a value.
-- 4. Create the unique index declared in the schema.

ALTER TABLE "platform_order" ADD COLUMN "order_number" text;--> statement-breakpoint

DO $$
DECLARE
  rec RECORD;
  candidate text;
  exists_count integer;
  attempts integer;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  max_attempts integer := 50;
BEGIN
  FOR rec IN
    SELECT id FROM "platform_order" WHERE "order_number" IS NULL
  LOOP
    attempts := 0;
    LOOP
      attempts := attempts + 1;
      IF attempts > max_attempts THEN
        RAISE EXCEPTION 'Failed to generate a unique order number for platform_order % after % attempts', rec.id, max_attempts;
      END IF;

      candidate := '';
      FOR i IN 1..8 LOOP
        candidate := candidate || substr(alphabet, ceil(random() * length(alphabet))::integer, 1);
      END LOOP;

      SELECT COUNT(*) INTO exists_count
      FROM "platform_order"
      WHERE "order_number" = candidate;

      EXIT WHEN exists_count = 0;
    END LOOP;

    UPDATE "platform_order"
    SET "order_number" = candidate
    WHERE id = rec.id;
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "platform_order" ALTER COLUMN "order_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_order_order_number_unique" ON "platform_order" USING btree ("order_number");
