# Payment Provider Degradation (Mollie)

## Symptoms

- Orders remain `pending_payment` after the buyer paid.
- `eurtisan_mollie_webhook_failed_total` or `eurtisan_mollie_payment_reconciliation_errors_total` increases.
- `eurtisan_mollie_oldest_pending_payment_age_seconds` exceeds the alert threshold.
- Loki contains `Mollie webhook processing failed` or `Mollie pending payment reconciliation failed` with `alert: true`.

## Immediate actions

1. Check Mollie's status page and API-key validity in the production environment.
2. Verify `POST https://eurtisan.eu/api/webhooks/mollie` is publicly reachable and accepts `application/x-www-form-urlencoded` requests.
3. Inspect recent classic payment webhook deliveries in the Mollie dashboard.
4. Check the `mollie-payment-reconciliation` container and its last-success metric.
5. For a known payment id, retrieve payment state through Mollie's API without logging the API key or full response.

## Automated reconciliation

The `mollie-payment-reconciliation` worker polls pending Mollie-backed orders after a short delay and invokes the same idempotent transition used by the webhook. It must run continuously in production.

```bash
docker compose -f docker-compose.prod.yml ps mollie-payment-reconciliation
docker compose -f docker-compose.prod.yml logs --since 30m mollie-payment-reconciliation
docker compose -f docker-compose.prod.yml restart mollie-payment-reconciliation
```

Do not update paid order, inventory, invoice, or payout rows manually while the worker is active. If a payment is moved to `manual_review` because its amount or inventory did not match, use the documented administrative review flow and two-person approval for financial corrections.

## Classic webhook contract

Mollie's classic Payments API callback contains a form-encoded `id` field and has no callback signature. Eurtisan treats the callback as a notification only: it retrieves authoritative payment state with `MOLLIE_API_KEY` before applying any transition. Provider or database failures return a non-2xx response so Mollie retries.

## Chargebacks

See [chargeback-received.md](./chargeback-received.md).
