-- Revert payouts that were released before the unified 30-day dispute window expired.
-- This migration is idempotent: rows already pending are not touched, and re-running
-- it simply finds no remaining rows once all premature releases are corrected.
UPDATE "payout"
SET
  "status" = 'pending',
  "sent_at" = NULL,
  "executed_at" = NULL,
  "mollie_route_id" = NULL,
  "reversed_at" = NULL,
  "reversal_reason" = NULL
WHERE "status" = 'sent'
  AND EXISTS (
    SELECT 1
    FROM "shop_order"
    WHERE "shop_order"."id" = "payout"."shop_order_id"
      AND "shop_order"."dispute_window_expires_at" > NOW()
  );
