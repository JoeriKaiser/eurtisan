/**
 * Retention cleanup for payout reconciliation logs.
 *
 * Deletes payout_reconciliation_log rows older than the configured retention
 * period. Payloads may contain PII and must not be logged.
 */

import { inArray, lt, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { payoutReconciliationLog } from '#/db/schema'
import { getPayoutReconciliationLogRetentionDays } from '#/lib/env.server'

export async function cleanupPayoutReconciliationLog(
  retentionDays: number,
  batchSize: number,
): Promise<{ deleted: number }> {
  const subquery = db
    .select({ id: payoutReconciliationLog.id })
    .from(payoutReconciliationLog)
    .where(lt(payoutReconciliationLog.createdAt, sql`now() - INTERVAL '1 day' * ${retentionDays}`))
    .limit(batchSize)

  const result = await db
    .delete(payoutReconciliationLog)
    .where(inArray(payoutReconciliationLog.id, subquery))

  return { deleted: result.rowCount ?? 0 }
}

export async function cleanupPayoutReconciliationLogWithDefaultRetention(
  batchSize: number,
): Promise<{ deleted: number }> {
  return cleanupPayoutReconciliationLog(getPayoutReconciliationLogRetentionDays(), batchSize)
}
