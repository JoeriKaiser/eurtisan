/**
 * Prometheus metrics for business-critical operations.
 *
 * Exposed at GET /api/metrics (scraped by Grafana Prometheus in production).
 */

import { Counter, Gauge, Histogram, collectDefaultMetrics, Registry } from 'prom-client'

export const metricsRegistry = new Registry()

collectDefaultMetrics({ register: metricsRegistry })

export const healthDbConnected = new Gauge({
  name: 'eurtisan_health_db_connected',
  help: 'Whether the database connectivity check succeeded (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
})

export const healthMeilisearchConnected = new Gauge({
  name: 'eurtisan_health_meilisearch_connected',
  help: 'Whether the Meilisearch connectivity check succeeded (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
})

export const healthDiskHealthy = new Gauge({
  name: 'eurtisan_health_disk_healthy',
  help: 'Whether the disk health check reports sufficient free space (1 = healthy, 0 = unhealthy)',
  registers: [metricsRegistry],
})

export const diskAvailableBytes = new Gauge({
  name: 'eurtisan_disk_available_bytes',
  help: 'Available bytes on the health-checked mount point',
  registers: [metricsRegistry],
})

export const healthMollieConnected = new Gauge({
  name: 'eurtisan_health_mollie_connected',
  help: 'Whether Mollie API is reachable (1 = connected/skipped, 0 = disconnected)',
  registers: [metricsRegistry],
})

export const healthBrevoConnected = new Gauge({
  name: 'eurtisan_health_brevo_connected',
  help: 'Whether Brevo API is reachable (1 = connected/skipped, 0 = disconnected)',
  registers: [metricsRegistry],
})

export const alertLogTotal = new Counter({
  name: 'eurtisan_alert_log_total',
  help: 'Number of log lines explicitly marked for alerting',
  labelNames: ['level'] as const,
  registers: [metricsRegistry],
})

/**
 * Background-job series are labelled `job_name`, **not** `job`.
 *
 * `job` is reserved: Prometheus sets it from the scrape target's `job_name`, and
 * with the default `honor_labels: false` a metric that carries its own `job`
 * label has it renamed to `exported_job` on ingest. These series were previously
 * labelled `job`, so every alert rule matching `job="<a background job>"` was
 * matching the scrape target name (`eurtisan`) instead — silently selecting
 * everything or nothing. Do not reintroduce a `job` label here.
 */
export const jobRunsTotal = new Counter({
  name: 'eurtisan_job_runs_total',
  help: 'Total number of job tick executions',
  labelNames: ['job_name', 'status'] as const,
  registers: [metricsRegistry],
})

export const jobRunDurationSeconds = new Histogram({
  name: 'eurtisan_job_run_duration_seconds',
  help: 'Job tick duration in seconds',
  labelNames: ['job_name'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
})

export const jobLastSuccessTimestamp = new Gauge({
  name: 'eurtisan_job_last_success_timestamp',
  help: 'Unix timestamp of the last successful job tick',
  labelNames: ['job_name'] as const,
  registers: [metricsRegistry],
})

export const jobLockContentionTotal = new Counter({
  name: 'eurtisan_job_lock_contention_total',
  help: 'Background job starts that could not acquire their singleton advisory lock',
  labelNames: ['job_name'] as const,
  registers: [metricsRegistry],
})

/**
 * Each job's own tick cadence, so staleness can be judged against what the job
 * actually promises rather than against one global threshold.
 *
 * This is what lets `EurtisanJobStale` cover a 60-second poller and a daily
 * cleanup with a single rule. Excluding slow jobs from the alert — the previous
 * approach — does not fix them, it removes their monitoring entirely.
 */
export const jobIntervalSeconds = new Gauge({
  name: 'eurtisan_job_interval_seconds',
  help: 'Configured tick interval for a background job, in seconds',
  labelNames: ['job_name'] as const,
  registers: [metricsRegistry],
})

export const financialReconciliationRecordsCheckedTotal = new Counter({
  name: 'eurtisan_financial_reconciliation_records_checked_total',
  help: 'Financial records checked by routine read-only reconciliation',
  labelNames: ['entity'] as const,
  registers: [metricsRegistry],
})

export const financialReconciliationMismatchesTotal = new Counter({
  name: 'eurtisan_financial_reconciliation_mismatches_total',
  help: 'Financial invariant mismatches detected by category',
  labelNames: ['category'] as const,
  registers: [metricsRegistry],
})

export const financialReconciliationLastRunMismatches = new Gauge({
  name: 'eurtisan_financial_reconciliation_last_run_mismatches',
  help: 'Financial invariant mismatches in the latest completed run by category',
  labelNames: ['category'] as const,
  registers: [metricsRegistry],
})

export const mollieWebhookFailedTotal = new Counter({
  name: 'eurtisan_mollie_webhook_failed_total',
  help: 'Mollie webhook requests that failed processing and returned 5xx',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry],
})

export const molliePendingPayments = new Gauge({
  name: 'eurtisan_mollie_pending_payments',
  help: 'Current number of pending platform orders linked to a Mollie payment',
  registers: [metricsRegistry],
})

export const mollieOldestPendingPaymentAgeSeconds = new Gauge({
  name: 'eurtisan_mollie_oldest_pending_payment_age_seconds',
  help: 'Age in seconds of the oldest pending platform order linked to Mollie',
  registers: [metricsRegistry],
})

export const molliePaymentReconciliationErrorsTotal = new Counter({
  name: 'eurtisan_mollie_payment_reconciliation_errors_total',
  help: 'Pending Mollie payments that failed an automated reconciliation attempt',
  registers: [metricsRegistry],
})

export const sendcloudWebhookFailedTotal = new Counter({
  name: 'eurtisan_sendcloud_webhook_failed_total',
  help: 'Sendcloud webhook requests that failed signature verification or returned 5xx',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry],
})

export const ordersCreatedTotal = new Counter({
  name: 'eurtisan_orders_created_total',
  help: 'Checkout sessions that created a platform order',
  registers: [metricsRegistry],
})

export const ordersPaidTotal = new Counter({
  name: 'eurtisan_orders_paid_total',
  help: 'Platform orders marked paid via payment webhook',
  registers: [metricsRegistry],
})

export const inventoryOversellTotal = new Counter({
  name: 'eurtisan_inventory_oversell_total',
  help: 'Paid orders committed against insufficient stock (requires manual intervention)',
  registers: [metricsRegistry],
})

export const ordersCancelledTotal = new Counter({
  name: 'eurtisan_orders_cancelled_total',
  help: 'Platform orders cancelled (payment failed/expired or chargeback)',
  registers: [metricsRegistry],
})

export const checkoutFailuresTotal = new Counter({
  name: 'eurtisan_checkout_failures_total',
  help: 'Checkout attempts that failed before order creation',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry],
})

export const webhookProcessedTotal = new Counter({
  name: 'eurtisan_webhook_processed_total',
  help: 'Webhook processing outcomes',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
})

export const emailSentTotal = new Counter({
  name: 'eurtisan_email_sent_total',
  help: 'Transactional emails accepted by the provider',
  labelNames: ['template'] as const,
  registers: [metricsRegistry],
})

export const emailFailedTotal = new Counter({
  name: 'eurtisan_email_failed_total',
  help: 'Transactional email send failures',
  labelNames: ['template'] as const,
  registers: [metricsRegistry],
})

export const emailQueuedTotal = new Counter({
  name: 'eurtisan_email_queued_total',
  help: 'Emails inserted into the outbox',
  labelNames: ['template'] as const,
  registers: [metricsRegistry],
})

export const emailBouncedTotal = new Counter({
  name: 'eurtisan_email_bounced_total',
  help: 'Bounce events received from provider',
  labelNames: ['reason'] as const,
  registers: [metricsRegistry],
})

export const emailComplainedTotal = new Counter({
  name: 'eurtisan_email_complained_total',
  help: 'Spam/complaint events received from provider',
  registers: [metricsRegistry],
})

export const emailDeliveredTotal = new Counter({
  name: 'eurtisan_email_delivered_total',
  help: 'Delivery confirmations received from provider',
  registers: [metricsRegistry],
})

export const searchQueriesTotal = new Counter({
  name: 'eurtisan_search_queries_total',
  help: 'Product search queries executed',
  labelNames: ['has_results'] as const,
  registers: [metricsRegistry],
})

export const searchResultClicksTotal = new Counter({
  name: 'eurtisan_search_result_clicks_total',
  help: 'Search results opened by buyers',
  registers: [metricsRegistry],
})

export const emailSuppressedSkipsTotal = new Counter({
  name: 'eurtisan_email_suppressed_skips_total',
  help: 'Transactional emails skipped due to suppression list',
  registers: [metricsRegistry],
})

export const meilisearchSyncQueueFailedTotal = new Counter({
  name: 'eurtisan_meilisearch_sync_queue_failed_total',
  help: 'Meilisearch sync queue items that reached failed status',
  registers: [metricsRegistry],
})

export const payoutStalePendingTotal = new Counter({
  name: 'eurtisan_payout_stale_pending_total',
  help: 'Payouts pending and approaching the 90-day routing window',
  registers: [metricsRegistry],
})

export const healthImgproxyConnected = new Gauge({
  name: 'eurtisan_health_imgproxy_connected',
  help: 'Whether imgproxy health endpoint is reachable (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
})

export const healthS3Connected = new Gauge({
  name: 'eurtisan_health_s3_connected',
  help: 'Whether S3-compatible object storage is reachable (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
})

export const emailOutboxBacklog = new Gauge({
  name: 'eurtisan_email_outbox_backlog',
  help: 'Number of email_outbox rows in pending/sending status older than 5 minutes',
  registers: [metricsRegistry],
})

export const backupSuccessTotal = new Counter({
  name: 'eurtisan_backup_success_total',
  help: 'Number of successful nightly backups',
  registers: [metricsRegistry],
})

export const backupFailuresTotal = new Counter({
  name: 'eurtisan_backup_failures_total',
  help: 'Number of failed nightly backups',
  registers: [metricsRegistry],
})

/**
 * Storefront reach.
 *
 * **Unlabelled, deliberately.** A shop id or slug label would make the
 * cardinality of this series grow with the marketplace, which is the classic way
 * to take down a Prometheus instance. Per-shop view counts are a product feature
 * with its own retention and privacy questions; they belong in the database, not
 * in a metric label.
 */
export const shopProfileViewsTotal = new Counter({
  name: 'eurtisan_shop_profile_views_total',
  help: 'Public shop storefront renders',
  registers: [metricsRegistry],
})

/**
 * How completely sellers fill in their public profile, as a fraction of the
 * publishable fields (0–1), sampled across active shops by a periodic job.
 *
 * The creator dashboard has nagged sellers to add a banner, socials, and an
 * announcement with no way to tell whether it works. Now that the storefront
 * actually renders those fields, this closes the loop.
 */
export const shopProfileCompleteness = new Histogram({
  name: 'eurtisan_shop_profile_completeness',
  help: 'Fraction of publishable profile fields populated, per active shop',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  registers: [metricsRegistry],
})

export async function getMetricsBody(): Promise<string> {
  return metricsRegistry.metrics()
}

export const metricsContentType = metricsRegistry.contentType
