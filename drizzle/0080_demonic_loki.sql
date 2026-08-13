CREATE TYPE "public"."notification_type" AS ENUM('order_placed', 'order_shipped', 'review_received', 'dispute_opened', 'dispute_resolved', 'payout_sent', 'order_refunded', 'order_chargeback', 'dac7_warning_limit', 'low_stock', 'shop_moderation_update', 'review_moderated', 'review_report_resolved');--> statement-breakpoint
-- Fails loudly, and readably, if any row carries a type the enum does not cover.
--
-- The `ALTER ... USING` below would fail on its own, but with a cast error that
-- names neither the offending value nor how to proceed. Since the whole point of
-- this migration is that the column was never constrained, a deploy that hits
-- unknown data deserves to be told exactly what it is.
DO $$
DECLARE
  unknown_types text;
BEGIN
  SELECT string_agg(DISTINCT "type", ', ') INTO unknown_types
  FROM "notification"
  WHERE "type" NOT IN (
    'order_placed', 'order_shipped', 'review_received', 'dispute_opened',
    'dispute_resolved', 'payout_sent', 'order_refunded', 'order_chargeback',
    'dac7_warning_limit', 'low_stock', 'shop_moderation_update',
    'review_moderated', 'review_report_resolved'
  );

  IF unknown_types IS NOT NULL THEN
    RAISE EXCEPTION 'notification.type contains values outside notification_type: %', unknown_types
      USING HINT = 'Map or delete these rows, then re-run the migration.';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";