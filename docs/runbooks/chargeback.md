# Chargeback runbook

## What is a chargeback?

A chargeback occurs when a buyer reverses a payment through their card issuer or
bank. Mollie notifies Eurtisan via the `chargeback` status on the payment
webhook.

## Automated handling

The platform webhook at `POST /api/webhooks/mollie` delegates chargeback events
to `handleChargeback(molliePaymentId)` in `src/lib/chargebacks.server.ts`. The
handler performs the following atomically:

1. Locates the platform order by `molliePaymentId`.
2. For every shop order under that platform order:
   - Reverses any `sent` or `in_transit` payout via `reversePayoutForRefund`.
   - Creates a credit note via `createCreditNoteForShopOrder`.
   - Restores sellable stock via `restoreShopOrderStockInTx`.
   - Sets the shop order status to `chargeback` and updates `refundedCents`.
3. Sets the platform order status to `chargeback`, records the full refund amount,
   and sets `cancellationReason` to `payment_chargeback`.
4. Emits an ops alert (`alert: true`) with the platform order and payment IDs.

## Idempotency

- If the platform order is already `chargeback`, the handler returns
  `already_processed` and does nothing.
- If the payment ID is unknown, it returns `unknown_payment`.
- Calling the handler twice creates only one credit note per shop order because
  `createCreditNoteForShopOrder` is idempotent.

## Partial chargebacks

Mollie delayed-routing payouts are reversed in full when a chargeback is
received. If Mollie ever supports partial chargebacks, the platform will treat
the event as a full chargeback and ops will need to reconcile the difference
manually. The handler logs the exact payment ID and order totals for this
purpose.

## Manual steps for ops

1. Check the platform order status in the admin panel or database:
   ```sql
   SELECT status, refunded_cents, cancellation_reason
   FROM platform_order
   WHERE mollie_payment_id = '<payment-id>';
   ```
2. Verify that each shop order under the platform order is `chargeback` and
   that payouts are `reversed`.
3. Verify that credit notes exist in `invoices` with `type = 'credit_note'`.
4. If stock was not restored (e.g. due to a transient error), call
   `restoreShopOrderStockInTx` manually or rerun the webhook.
5. Contact the affected seller(s) via the studio notification and inform them
   that the payout was reversed and the order is recorded as a chargeback.

## Monitoring

Prometheus alert rules in `infra/observability/prometheus/rules/` will fire on:

- `webhookProcessedTotal{status="chargeback"}` spikes.
- `ordersCancelledTotal` increases driven by chargebacks.
- Errors logged from `handleChargeback` with `alert: true`.
