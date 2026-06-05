# Payment Provider Degradation (Mollie)

## Symptoms

- Orders remain `pending_payment` after buyer paid
- `eurtisan_webhook_processed_total{status="provider_error"}` increasing
- Loki: `Mollie webhook` errors with `alert: true`

## Immediate actions

1. Check Mollie status page and API key validity in production `.env`
2. Verify webhook URL reachable: `https://eurtisan.eu/api/webhooks/mollie`
3. Inspect recent webhooks in Mollie dashboard for delivery failures
4. For a known-good payment ID, query status manually via Mollie API

## Reconciliation

1. Find affected `platform_order` rows (`status = pending_payment`, recent `created_at`)
2. Compare `mollie_payment_id` with Mollie dashboard status
3. If paid at Mollie but not in DB, trigger webhook replay from Mollie or run manual status update (admin + SQL only with two-person review)

## Chargebacks

See [chargeback-received.md](./chargeback-received.md).
