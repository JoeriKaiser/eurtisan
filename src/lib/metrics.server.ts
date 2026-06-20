/**
 * Prometheus metrics for business-critical operations.
 *
 * Exposed at GET /api/metrics (scraped by Grafana Prometheus in production).
 */

import { Counter, collectDefaultMetrics, Registry } from 'prom-client'

export const metricsRegistry = new Registry()

collectDefaultMetrics({ register: metricsRegistry })

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

export async function getMetricsBody(): Promise<string> {
  return metricsRegistry.metrics()
}

export const metricsContentType = metricsRegistry.contentType
