import { and, isNotNull, lt } from 'drizzle-orm'
import { db } from '#/db/index'
import { notification } from '#/db/schema'

/**
 * Deletes **read** notifications older than the retention period.
 *
 * `notification` was the only table holding personal data with no retention
 * rule: ten others have a purge job and a row in `DATA_RETENTION.md`, and this
 * one appeared there only under account deletion. Meanwhile `data` carries order
 * numbers, product names, shop names, buyer names, and moderation explanations.
 *
 * **Read only, deliberately.** An unread notification is undelivered
 * information — a chargeback the seller has not seen, or a statement of reasons
 * the author has not opened — and deleting it on a timer would destroy the only
 * copy the recipient has. Age alone is not consent to forget. So the cutoff is
 * measured on `readAt`, not `createdAt`: the clock starts when the recipient
 * has actually seen the thing.
 */
export async function purgeOldNotifications(retentionDays: number): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const deleted = await db
    .delete(notification)
    .where(and(isNotNull(notification.readAt), lt(notification.readAt, cutoff)))
    .returning({ id: notification.id })

  return { deleted: deleted.length }
}
