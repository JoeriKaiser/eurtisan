/**
 * Retention cleanup for the email outbox, send log, and Brevo webhook events.
 *
 * Terminal outbox rows are deleted after 7 days. Send log rows are deleted
 * after `EMAIL_SEND_LOG_RETENTION_DAYS` (default 90). Brevo webhook events
 * are deleted after 30 days.
 */

import { and, inArray, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { brevoWebhookEvent, emailOutbox, emailSendLog } from '#/db/schema'
import { getEmailSendLogRetentionDays } from '#/lib/env.server'

export async function cleanupEmailOutbox(batchSize: number): Promise<{ deleted: number }> {
  const subquery = db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(
      and(
        inArray(emailOutbox.status, ['sent', 'failed', 'suppressed', 'bounced']),
        lte(emailOutbox.updatedAt, sql`now() - INTERVAL '7 days'`),
      ),
    )
    .limit(batchSize)

  const result = await db.delete(emailOutbox).where(inArray(emailOutbox.id, subquery))

  return { deleted: result.rowCount ?? 0 }
}

export async function cleanupEmailSendLog(batchSize: number): Promise<{ deleted: number }> {
  const retentionDays = getEmailSendLogRetentionDays()
  const subquery = db
    .select({ id: emailSendLog.id })
    .from(emailSendLog)
    .where(lte(emailSendLog.createdAt, sql`now() - INTERVAL '1 day' * ${retentionDays}`))
    .limit(batchSize)

  const result = await db.delete(emailSendLog).where(inArray(emailSendLog.id, subquery))

  return { deleted: result.rowCount ?? 0 }
}

export async function cleanupBrevoWebhookEvents(batchSize: number): Promise<{ deleted: number }> {
  const subquery = db
    .select({ id: brevoWebhookEvent.id })
    .from(brevoWebhookEvent)
    .where(lte(brevoWebhookEvent.createdAt, sql`now() - INTERVAL '30 days'`))
    .limit(batchSize)

  const result = await db.delete(brevoWebhookEvent).where(inArray(brevoWebhookEvent.id, subquery))

  return { deleted: result.rowCount ?? 0 }
}
