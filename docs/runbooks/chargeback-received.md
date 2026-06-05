# Chargeback Received

## Symptoms

- Loki alert: `Mollie chargeback received for platform order` with `alert: true`
- Order `status` set to `chargeback` via webhook
- Metric `eurtisan_webhook_processed_total{status="chargeback"}` incremented

## Immediate actions

1. Locate order in admin → Orders using `platformOrderId` from logs
2. Confirm shop orders and payout state — **do not** mark payout sent for chargeback orders
3. Notify affected seller via support process
4. Gather evidence (tracking, buyer communication) for Mollie dispute portal

## Financial reconciliation

- Expect funds debited by Mollie; align with accounting
- If dispute resolution already issued a refund, reconcile duplicate recovery manually
