# Job Failure Runbook

Background jobs are wrapped with `withJobMetrics`, which emits Prometheus metrics (`eurtisan_job_runs_total`, `eurtisan_job_last_success_timestamp`) and structured alert logs on failure. This runbook covers how to respond when Prometheus or Loki alerts fire for a job.

## Affected jobs

All long-running jobs in `src/jobs/` are instrumented:

- `inventory-cleanup`
- `cart-cleanup`
- `session-cleanup`
- `verification-cleanup`
- `audit-log-cleanup`
- `email-retention-cleanup`
- `email-suppression-cleanup`
- `mollie-payment-reconciliation`
- `payout-reconciliation`
- `sendcloud-reconciliation`
- `financial-totals-reconciliation` (also see [financial-reconciliation.md](./financial-reconciliation.md))
- `meilisearch-sync` (if running as a continuous job)
- `shop-profile-completeness` (hourly; samples `eurtisan_shop_profile_completeness`)

### `EurtisanJobStale` measures each job against its own cadence

The alert fires when a job has gone more than **three of its own configured
intervals** without a successful tick, not against one global window. A
60-second poller and a daily cleanup are both covered by the same rule, and no
job needs an exclusion.

This depends on each job calling `declareJobInterval(JOB_NAME, INTERVAL_MS)` at
start-up, which populates `eurtisan_job_interval_seconds{job_name}`. A job that
does not is **left unmonitored by the staleness rule** — the vector match simply
drops it — and is reported by `EurtisanJobMissingInterval` instead. That is
deliberate: an absent interval series is greppable, whereas a job silently
measured against a wrong threshold is not.

### The `job` label is reserved — use `job_name`

Prometheus sets `job` from the scrape target's `job_name`. With the default
`honor_labels: false`, a scraped metric carrying its own `job` label has it
renamed to `exported_job` on ingest.

These series were previously labelled `job`, so **every rule matching
`job="<a background job>"` was matching the scrape target instead** —
`EurtisanJobStale`'s exclusion list excluded nothing, the three
`financial-reconciliation.yml` rules selected no series at all, and alert
summaries rendered "eurtisan" in place of the job name. All job metrics now use
`job_name`. Do not reintroduce a `job` label on a metric.

Alert-rule behaviour is covered by `make promtool-test`
(`infra/observability/prometheus/tests/`), which runs in CI alongside
`make promtool-check`. `promtool-check` only proves the PromQL parses; the tests
prove it selects the right series and fires when it should.

## Alerts

| Alert | Severity | Meaning |
|-------|----------|---------|
| `EurtisanJobAlertLog` | warning | A log line with `alert: true` was emitted in the last 5 minutes. |
| `EurtisanJobTickFailure` | warning | A job tick threw an exception (metric `eurtisan_job_runs_total{status="failure"}`). |
| `EurtisanJobStale` | critical | A job has not recorded a successful tick in the last 10 minutes. |

## Immediate response

1. **Identify the job** from the alert labels (`{{ $labels.job }}`).
2. **Check logs** for the job in Grafana (Loki) or via Docker:
   ```bash
   ssh ubuntu@PROD_IP
   docker logs --since 30m eurtisan-app | grep '"job":"<job-name>"'
   ```
3. **Check metrics** to distinguish a transient tick failure from a stuck job:
   ```bash
   curl -fsS http://localhost:3000/api/metrics | grep eurtisan_job
   ```
   Look for:
   - `eurtisan_job_runs_total{job="<job-name>",status="failure"}` increasing
   - `eurtisan_job_last_success_timestamp{job="<job-name>"}` stale

## Common causes and fixes

### Transient external API failure

Jobs that call Mollie, Sendcloud, or Brevo may fail because of rate limits, timeouts, or provider outages.

- Check the provider status page.
- Look for `5xx` or `429` responses in the logs.
- Most jobs retry on the next tick; no manual action is required unless the failure persists for multiple ticks.

### Database connection exhaustion

A stuck or failing tick may be caused by connection pool saturation.

- Check `eurtisan_db_pool_active` and `eurtisan_db_pool_waiting` in Prometheus.
- If the pool is exhausted, inspect long-running queries:
  ```bash
  docker compose -f docker-compose.prod.yml exec db psql -U eurtisan -c "SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start;"
  ```
- Restarting the app container is a last resort; prefer killing the offending query.

### Job container not running

For jobs deployed as separate containers, verify the container is up:

```bash
docker compose -f docker-compose.prod.yml ps
```

If a job container is `Exited` or `Restarting`, inspect its logs and restart:

```bash
docker compose -f docker-compose.prod.yml logs --tail 100 <job-container>
docker compose -f docker-compose.prod.yml up -d <job-container>
```

### Stale job (no successful tick)

A stale job usually means the polling loop crashed or the process is hung.

1. Check the app/job container logs for the last successful tick.
2. If the process is alive but not ticking, restart the container:
   ```bash
   docker compose -f docker-compose.prod.yml restart app
   # or for a dedicated job container
   docker compose -f docker-compose.prod.yml restart <job-container>
   ```
3. After restart, confirm `eurtisan_job_last_success_timestamp` updates within the job's interval.

## Manual tick execution

To run a job tick manually for debugging or to recover from a missed window:

```bash
ssh ubuntu@PROD_IP
cd /opt/eurtisan
docker compose -f docker-compose.prod.yml exec app bun run job:<job-name>
```

Example:

```bash
docker compose -f docker-compose.prod.yml exec app bun run job:inventory-cleanup
```

## Verification

After remediation:

1. Confirm the job tick succeeds manually (if applicable).
2. Watch `eurtisan_job_runs_total{job="<job-name>",status="success"}` increase.
3. Confirm `eurtisan_job_last_success_timestamp{job="<job-name>"}` is recent (within one interval).
4. Resolve the alert in Alertmanager once the metric is green.

## Prevention

- Keep job intervals conservative; avoid overlapping ticks.
- Monitor external API rate limits and adjust intervals if needed.
- Ensure `DATABASE_POOL_MAX` leaves headroom for migrations and ad-hoc queries.
- Run quarterly disaster-recovery drills that include stopping and restarting job containers.
