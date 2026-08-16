/**
 * Background job registry for the unified worker daemon.
 *
 * Defines the complete inventory of background jobs, their execution cadences,
 * and individual tick handlers.
 */
import { purgeOldAuditLogs } from '#/lib/audit-log.server'
import { cleanupExpiredSessions } from '#/lib/session-cleanup.server'
import { cleanupExpiredVerifications } from '#/lib/verification-cleanup.server'
import { clearExpiredCarts } from '#/lib/cart.server'
import {
  cleanupBrevoWebhookEvents,
  cleanupEmailOutbox,
  cleanupEmailSendLog,
} from '#/lib/email-retention-cleanup.server'
import { cleanupExpiredSuppressions } from '#/lib/email-suppression-cleanup.server'
import {
  getEmailOutboxWorkerBatchSize,
  getEmailOutboxWorkerIntervalMs,
  getFinancialTotalsReconciliationBatchSize,
  getFinancialTotalsReconciliationIntervalMs,
  getMolliePaymentReconciliationBatchSize,
  getMolliePaymentReconciliationIntervalMs,
  getMolliePaymentReconciliationMinAgeMs,
  getNotificationDigestIntervalMs,
  getPayoutReconciliationIntervalMs,
  getPayoutReconciliationLogRetentionDays,
  getSendcloudReconciliationIntervalMs,
  getSendcloudWebhookRetentionDays,
} from '#/lib/env.server'
import type { JobName } from '#/lib/infra/job-lock.server'
import {
  cancelAbandonedPendingPaymentOrders,
  releaseExpiredReservations,
} from '#/lib/inventory.server'
import { runFinancialTotalsReconciliation } from '#/lib/jobs/financial-totals-reconciliation.server'
import { logger } from '#/lib/logger.server'
import { processMeilisearchSyncQueue } from '#/lib/meilisearch-products.server'
import { shopProfileCompleteness } from '#/lib/metrics.server'
import { enqueuePreviousUtcDayDigests } from '#/lib/notifications/digest.server'
import { purgeOldNotifications } from '#/lib/notifications/retention.server'
import { reconcilePendingMolliePayments } from '#/lib/payments/mollie-reconciliation.server'
import { cleanupPayoutReconciliationLog } from '#/lib/payout-reconciliation-log-cleanup.server'
import {
  alertOnStalePendingPayouts,
  reconcilePayouts,
  releaseHeldPayouts,
} from '#/lib/payout-reconciliation.server'
import { purgeOldSearchEvents } from '#/lib/search/analytics.server'
import { reconcileSendcloudShipments } from '#/lib/sendcloud-reconciliation.server'
import { cleanupSendcloudWebhookEvents } from '#/lib/sendcloud-retention-cleanup.server'
import { getShopProfileCompletenessSamples } from '#/lib/shops/public-profile.server'
import { processEmailOutboxTick } from '#/lib/email-outbox-processor.server'

export interface JobRunnerDefinition {
  name: JobName
  getIntervalMs: () => number
  tick: () => Promise<void>
}

let emailOutboxTickCounter = 0

export const ALL_BACKGROUND_JOBS: readonly JobRunnerDefinition[] = [
  {
    name: 'inventory-cleanup',
    getIntervalMs: () => Number.parseInt(process.env.INVENTORY_CLEANUP_INTERVAL_MS ?? '60000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(process.env.INVENTORY_CLEANUP_BATCH_SIZE ?? '100', 10)
      const reservationResult = await releaseExpiredReservations(batchSize)
      if (reservationResult.releasedCount > 0) {
        logger.info(
          `[inventory-cleanup] Released ${reservationResult.releasedCount} expired reservation(s)`,
          { job: 'inventory-cleanup', releasedCount: reservationResult.releasedCount },
        )
      }
      const orderResult = await cancelAbandonedPendingPaymentOrders(batchSize)
      if (orderResult.cancelledCount > 0) {
        logger.info(
          `[inventory-cleanup] Cancelled ${orderResult.cancelledCount} abandoned order(s)`,
          { job: 'inventory-cleanup', cancelledCount: orderResult.cancelledCount },
        )
      }
    },
  },
  {
    name: 'cart-cleanup',
    getIntervalMs: () => Number.parseInt(process.env.CART_CLEANUP_INTERVAL_MS ?? '60000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(process.env.CART_CLEANUP_BATCH_SIZE ?? '100', 10)
      const result = await clearExpiredCarts(batchSize)
      if (result.deletedCount > 0) {
        logger.info(`[cart-cleanup] Deleted ${result.deletedCount} expired cart(s)`, {
          job: 'cart-cleanup',
          deletedCount: result.deletedCount,
        })
      }
    },
  },
  {
    name: 'session-cleanup',
    getIntervalMs: () => Number.parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS ?? '60000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(process.env.SESSION_CLEANUP_BATCH_SIZE ?? '100', 10)
      const result = await cleanupExpiredSessions(batchSize)
      if (result.deletedCount > 0) {
        logger.info(`[session-cleanup] Deleted ${result.deletedCount} expired session(s)`, {
          job: 'session-cleanup',
          deletedCount: result.deletedCount,
        })
      }
    },
  },
  {
    name: 'verification-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.VERIFICATION_CLEANUP_INTERVAL_MS ?? '60000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(process.env.VERIFICATION_CLEANUP_BATCH_SIZE ?? '100', 10)
      const result = await cleanupExpiredVerifications(batchSize)
      if (result.deletedCount > 0) {
        logger.info(
          `[verification-cleanup] Deleted ${result.deletedCount} expired verification(s)`,
          {
            job: 'verification-cleanup',
            deletedCount: result.deletedCount,
          },
        )
      }
    },
  },
  {
    name: 'audit-log-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.AUDIT_LOG_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const retentionDays = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '365', 10)
      const result = await purgeOldAuditLogs(retentionDays)
      if (result.deletedCount > 0) {
        logger.info(`[audit-log-cleanup] Deleted ${result.deletedCount} old audit log entry(s)`, {
          job: 'audit-log-cleanup',
          deletedCount: result.deletedCount,
        })
      }
    },
  },
  {
    name: 'search-event-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.SEARCH_EVENT_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const retentionDays = Number.parseInt(process.env.SEARCH_EVENT_RETENTION_DAYS ?? '180', 10)
      const result = await purgeOldSearchEvents(retentionDays)
      if (result.deleted > 0) {
        logger.info(`[search-event-cleanup] Deleted ${result.deleted} old search event(s)`, {
          job: 'search-event-cleanup',
          deletedCount: result.deleted,
        })
      }
    },
  },
  {
    name: 'notification-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.NOTIFICATION_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const retentionDays = Number.parseInt(process.env.NOTIFICATION_RETENTION_DAYS ?? '365', 10)
      const result = await purgeOldNotifications(retentionDays)
      if (result.deleted > 0) {
        logger.info(`[notification-cleanup] Deleted ${result.deleted} read notification(s)`, {
          job: 'notification-cleanup',
          deletedCount: result.deleted,
        })
      }
    },
  },
  {
    name: 'notification-digest',
    getIntervalMs: () => getNotificationDigestIntervalMs(),
    tick: async () => {
      const result = await enqueuePreviousUtcDayDigests()
      logger.info('notification.digest.batch', { job: 'notification-digest', ...result })
    },
  },
  {
    name: 'email-outbox-worker',
    getIntervalMs: () => getEmailOutboxWorkerIntervalMs(),
    tick: async () => {
      emailOutboxTickCounter += 1
      await processEmailOutboxTick(getEmailOutboxWorkerBatchSize(), emailOutboxTickCounter)
    },
  },
  {
    name: 'email-suppression-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.EMAIL_SUPPRESSION_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(
        process.env.EMAIL_SUPPRESSION_CLEANUP_BATCH_SIZE ?? '1000',
        10,
      )
      const result = await cleanupExpiredSuppressions(batchSize)
      if (result.deleted > 0) {
        logger.info(
          `[email-suppression-cleanup] Deleted ${result.deleted} expired suppression(s)`,
          { job: 'email-suppression-cleanup', deleted: result.deleted },
        )
      }
    },
  },
  {
    name: 'email-retention-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.EMAIL_RETENTION_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(
        process.env.EMAIL_RETENTION_CLEANUP_BATCH_SIZE ?? '1000',
        10,
      )
      const [outbox, sendLog, webhookEvents] = await Promise.all([
        cleanupEmailOutbox(batchSize),
        cleanupEmailSendLog(batchSize),
        cleanupBrevoWebhookEvents(batchSize),
      ])
      if (outbox.deleted > 0 || sendLog.deleted > 0 || webhookEvents.deleted > 0) {
        logger.info(
          `[email-retention-cleanup] Deleted outbox=${outbox.deleted}, send_log=${sendLog.deleted}, brevo_webhook_event=${webhookEvents.deleted}`,
          {
            job: 'email-retention-cleanup',
            outboxDeleted: outbox.deleted,
            sendLogDeleted: sendLog.deleted,
            brevoWebhookEventsDeleted: webhookEvents.deleted,
          },
        )
      }
    },
  },
  {
    name: 'financial-totals-reconciliation',
    getIntervalMs: () => getFinancialTotalsReconciliationIntervalMs(),
    tick: async () => {
      await runFinancialTotalsReconciliation(getFinancialTotalsReconciliationBatchSize())
    },
  },
  {
    name: 'meilisearch-sync',
    getIntervalMs: () => Number.parseInt(process.env.MEILISEARCH_SYNC_INTERVAL_MS ?? '5000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(process.env.MEILISEARCH_SYNC_BATCH_SIZE ?? '50', 10)
      const result = await processMeilisearchSyncQueue(batchSize)
      if (result.processedCount > 0) {
        logger.info(`[meilisearch-sync] Processed ${result.processedCount} sync queue items`, {
          job: 'meilisearch-sync',
          processedCount: result.processedCount,
        })
      }
    },
  },
  {
    name: 'mollie-payment-reconciliation',
    getIntervalMs: () => getMolliePaymentReconciliationIntervalMs(),
    tick: async () => {
      const result = await reconcilePendingMolliePayments({
        minAgeMs: getMolliePaymentReconciliationMinAgeMs(),
        batchSize: getMolliePaymentReconciliationBatchSize(),
      })
      if (result.checked > 0 || result.errors > 0) {
        logger.info(
          `[mollie-payment-reconciliation] Checked ${result.checked} payment(s), processed ${result.processed}, pending ${result.pending}, manual review ${result.manualReview}, errors ${result.errors}`,
          { job: 'mollie-payment-reconciliation', ...result },
        )
      }
      if (result.errors > 0) {
        throw new Error(`Failed to reconcile ${result.errors} Mollie payment(s)`)
      }
    },
  },
  {
    name: 'payout-reconciliation',
    getIntervalMs: () => getPayoutReconciliationIntervalMs(),
    tick: async () => {
      const result = await reconcilePayouts()
      if (result.checked > 0) {
        logger.info(
          `[payout-reconciliation] Checked ${result.checked} payout(s), reversed ${result.reversed}, errors ${result.errors}`,
          { job: 'payout-reconciliation', ...result },
        )
      }
      const staleCount = await alertOnStalePendingPayouts()
      if (staleCount > 0) {
        logger.info(`[payout-reconciliation] Alerted on ${staleCount} stale pending payout(s)`, {
          job: 'payout-reconciliation',
          staleCount,
        })
      }
      const releaseResult = await releaseHeldPayouts()
      if (releaseResult.checked > 0) {
        logger.info(
          `[payout-reconciliation] Released ${releaseResult.released} of ${releaseResult.checked} held payout(s), errors ${releaseResult.errors}`,
          { job: 'payout-reconciliation', ...releaseResult },
        )
      }
    },
  },
  {
    name: 'payout-reconciliation-log-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.PAYOUT_RECONCILIATION_LOG_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(
        process.env.PAYOUT_RECONCILIATION_LOG_CLEANUP_BATCH_SIZE ?? '1000',
        10,
      )
      const result = await cleanupPayoutReconciliationLog(
        getPayoutReconciliationLogRetentionDays(),
        batchSize,
      )
      if (result.deleted > 0) {
        logger.info(`[payout-reconciliation-log-cleanup] Deleted ${result.deleted} log row(s)`, {
          job: 'payout-reconciliation-log-cleanup',
          deleted: result.deleted,
          retentionDays: getPayoutReconciliationLogRetentionDays(),
        })
      }
    },
  },
  {
    name: 'sendcloud-reconciliation',
    getIntervalMs: () => getSendcloudReconciliationIntervalMs(),
    tick: async () => {
      const result = await reconcileSendcloudShipments()
      if (result.checked > 0) {
        logger.info(
          `[sendcloud-reconciliation] Checked ${result.checked} shipment(s), updated ${result.updated}, errors ${result.errors}`,
          { job: 'sendcloud-reconciliation', ...result },
        )
      }
    },
  },
  {
    name: 'sendcloud-retention-cleanup',
    getIntervalMs: () =>
      Number.parseInt(process.env.SENDCLOUD_WEBHOOK_CLEANUP_INTERVAL_MS ?? '86400000', 10),
    tick: async () => {
      const batchSize = Number.parseInt(
        process.env.SENDCLOUD_WEBHOOK_CLEANUP_BATCH_SIZE ?? '1000',
        10,
      )
      const result = await cleanupSendcloudWebhookEvents(batchSize)
      if (result.deleted > 0) {
        logger.info(`[sendcloud-retention-cleanup] Deleted ${result.deleted} webhook event(s)`, {
          job: 'sendcloud-retention-cleanup',
          deleted: result.deleted,
          retentionDays: getSendcloudWebhookRetentionDays(),
        })
      }
    },
  },
  {
    name: 'shop-profile-completeness',
    getIntervalMs: () =>
      Number.parseInt(process.env.SHOP_PROFILE_COMPLETENESS_INTERVAL_MS ?? '3600000', 10),
    tick: async () => {
      const samples = await getShopProfileCompletenessSamples()
      shopProfileCompleteness.reset()
      for (const fraction of samples) {
        shopProfileCompleteness.observe(fraction)
      }
      logger.info(`[shop-profile-completeness] Sampled ${samples.length} active shop(s)`, {
        job: 'shop-profile-completeness',
        shopCount: samples.length,
      })
    },
  },
]

export function getJobByName(name: string): JobRunnerDefinition | undefined {
  return ALL_BACKGROUND_JOBS.find((j) => j.name === name)
}

export function filterBackgroundJobs(options: {
  only?: string[]
  exclude?: string[]
}): JobRunnerDefinition[] {
  let jobs = [...ALL_BACKGROUND_JOBS]

  if (options.only && options.only.length > 0) {
    const onlySet = new Set(options.only)
    jobs = jobs.filter((j) => onlySet.has(j.name))
  }

  if (options.exclude && options.exclude.length > 0) {
    const excludeSet = new Set(options.exclude)
    jobs = jobs.filter((j) => !excludeSet.has(j.name))
  }

  return jobs
}
