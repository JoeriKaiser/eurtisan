# Financial totals reconciliation

## Purpose and cadence

`financial-totals-reconciliation` runs immediately at process start and every six hours by default (`FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS=21600000`). This cadence is appropriate for launch volume: it bounds drift exposure without continuously scanning accounting tables. Queries use a repeatable-read, read-only PostgreSQL transaction and keyset batches of 500 records by default (`FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE`).

The routine job never inserts or updates orders, order items, invoices, refunds, payouts, financial audit rows, or provider state. A PostgreSQL advisory lock prevents overlap across replicas and restarts. The internal metrics endpoint is reachable only on the Docker network and requires `METRICS_TOKEN`.

## Alerts and signals

| Alert | Severity | Required response |
|---|---|---|
| `EurtisanFinancialReconciliationMismatch` | critical | Investigate every category; no automatic repair. |
| `EurtisanFinancialReconciliationFailed` | critical | Restore the scan and preserve failure evidence. |
| `EurtisanFinancialReconciliationStale` | critical | Restore a successful run within the six-hour cadence plus one-hour grace. |
| `EurtisanFinancialReconciliationLockContention` | warning | Check duplicate services, restart loops, or replica configuration. |

Every mismatch log includes `runId`, category, entity type and internal entity identifier, field, stored value, computed value, and difference. These identifiers are correlation data, not customer or seller PII. Never add names, addresses, email addresses, VAT IDs, billing details, provider credentials, or payment tokens to evidence.

Useful metrics:

- `eurtisan_financial_reconciliation_records_checked_total{entity}`
- `eurtisan_financial_reconciliation_mismatches_total{category}`
- `eurtisan_financial_reconciliation_last_run_mismatches{category}`
- `eurtisan_job_run_duration_seconds{job="financial-totals-reconciliation"}`
- `eurtisan_job_last_success_timestamp{job="financial-totals-reconciliation"}`
- `eurtisan_job_lock_contention_total{job="financial-totals-reconciliation"}`
- `eurtisan_job_runs_total{job="financial-totals-reconciliation",status="failure"}`

## Exit semantics

The deployed service is continuous. Polling-tick failures are recorded and retried at the next cadence; startup, environment, lock-connection, and metrics-server failures terminate with exit code 1 so the container supervisor can act.

The owner-authorized one-shot form is detection-only:

```bash
docker compose -f docker-compose.staging.yml run --rm financial-totals-reconciliation \
  bun run job:financial-totals-reconciliation --once
```

- `0`: scan completed and balanced;
- `1`: scan or startup failed;
- `2`: scan completed and detected mismatch;
- `3`: singleton lock was already held.

## Investigation

1. Acknowledge the alert without resolving it. Record the immutable release, environment, alert time, `runId`, mismatch category, and internal entity IDs.
2. Confirm the job container, last-success metric, duration, records checked, and whether lock contention or a deployment occurred.
3. Query affected rows read-only. Compare order items, shop/platform totals, customer and platform-fee invoices, credit notes, refund totals, payout amount/status, and provider identifiers. Do not copy encrypted billing details into tickets or reports.
4. For provider-state findings, compare only in the authorized provider dashboard and record a safe dashboard evidence reference. Do not paste provider payloads or credentials.
5. Determine whether concurrent business activity occurred. The scan uses one repeatable-read snapshot, so a change committed after the snapshot should appear on the next run, not as an internally inconsistent result.
6. Run detection again only after preserving the original evidence. A clean second run does not erase the need to explain the first mismatch.

## Escalation thresholds

- **Accounting owner immediately:** any mismatch, any invoice/VAT/platform-fee category, or any payout/refund disagreement.
- **Legal/privacy owner immediately:** invoice or credit-note integrity, VAT treatment, chargeback evidence, statutory record retention, or evidence that may contain personal data.
- **Operations and security immediately:** unexplained data mutation, repeated failures, unexpected duplicate service, or suspected unauthorized correction.
- **Provider owner:** incomplete Mollie state or disagreement with provider-authoritative status.

No monetary tolerance is silently accepted. One cent is a mismatch. Accounting may classify impact after investigation, but engineering must not suppress or round away the signal.

## Safe correction procedure

There is no automatic repair command. Recalculation helpers are used only inside the checkout write transaction and are not an operational repair interface.

A correction requires all of the following:

1. written accounting approval and, for VAT/invoice/chargeback changes, legal approval;
2. an identified incident/change record and named operator/reviewer;
3. a fresh encrypted backup and verified restore point;
4. a reviewed, narrowly scoped migration or transaction with explicit before/after invariants;
5. least-privilege production authorization and a maintenance window when required;
6. immutable audit evidence containing safe row identifiers, reason, approvals, script digest, execution time, and row counts;
7. post-correction read-only reconciliation, invoice/VAT report verification, payout verification, and provider comparison;
8. rollback or compensating-entry plan. Issued invoices should normally be corrected with legally valid credit notes/replacement documents, not overwritten.

Never edit provider dashboards to make local records appear consistent, delete mismatch evidence, or invoke checkout recalculation helpers against historical orders without the reviewed procedure above.

## Controlled staging discrepancy qualification

Status: **not-run**. Owner: operations with accounting review. Blocker: an authorized isolated EU staging qualification database and owner approval are required.

Use a disposable database cloned from non-PII staging fixtures, not the shared staging database. Seed one deterministic one-cent mismatch and point a temporary continuous instance of the production service at that clone; expect the matching structured log, category metric, mismatch alert, and `runId`. Separately run the production image in one-shot mode against the clone and expect exit code 2. Restore or destroy the clone, run a balanced one-shot scan expecting exit code 0, and retain only redacted evidence references. Also trigger a failed run and delayed run to verify failure/stale alert routing. The qualification check `jobs.financial-discrepancy-detection` must remain `not-run` until an owner records those observations.
