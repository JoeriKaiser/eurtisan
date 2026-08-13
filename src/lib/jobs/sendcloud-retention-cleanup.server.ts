/**
 * Retention cleanup for Sendcloud webhook events.
 *
 * Deletes Sendcloud webhook event rows older than the configured retention
 * period (default 30 days). Payloads contain PII and must not be logged.
 */

import { inArray, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { sendcloudWebhookEvent } from '#/db/schema'
import { getSendcloudWebhookRetentionDays } from '#/lib/env.server'

export async function cleanupSendcloudWebhookEvents(
  batchSize: number,
): Promise<{ deleted: number }> {
  const retentionDays = getSendcloudWebhookRetentionDays()
  const subquery = db
    .select({ id: sendcloudWebhookEvent.id })
    .from(sendcloudWebhookEvent)
    .where(lte(sendcloudWebhookEvent.createdAt, sql`now() - INTERVAL '1 day' * ${retentionDays}`))
    .limit(batchSize)

  const result = await db
    .delete(sendcloudWebhookEvent)
    .where(inArray(sendcloudWebhookEvent.id, subquery))

  return { deleted: result.rowCount ?? 0 }
}
