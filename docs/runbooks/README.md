# Production Runbooks

Operational procedures for on-call engineers. Pair with Grafana (Loki logs, Prometheus metrics) on the observability stack.

| Runbook | When to use |
|---------|-------------|
| [database-outage.md](./database-outage.md) | App `/api/health/ready` fails DB check, checkout errors spike |
| [payment-provider-degradation.md](./payment-provider-degradation.md) | Mollie webhooks failing, orders stuck in `pending_payment` |
| [meilisearch-failure.md](./meilisearch-failure.md) | Search empty/errors, `eurtisan_meilisearch_sync_queue_failed_total` increasing |
| [disk-full.md](./disk-full.md) | Health disk check failing, backup job errors |
| [backup-restore.md](./backup-restore.md) | Data loss, need point-in-time or nightly restore |
| [chargeback-received.md](./chargeback-received.md) | `Mollie chargeback received` alert, order status `chargeback` |
| [job-failure.md](./job-failure.md) | Background job alerts (`EurtisanJobTickFailure`, `EurtisanJobStale`, `EurtisanJobAlertLog`) |
| [financial-reconciliation.md](./financial-reconciliation.md) | Financial drift, missed scans, lock contention, evidence, escalation, and authorized correction |
| [environment-configuration.md](./environment-configuration.md) | Build/runtime configuration, routing, secret ownership, or credential rotation |
| [release-quality-gates.md](./release-quality-gates.md) | Reproduce CI, migration, bundle, image, Compose, and infrastructure gates locally |
| [staging-qualification.md](./staging-qualification.md) | Collect honest EU staging, provider, recovery, observability, performance, and approval evidence |
