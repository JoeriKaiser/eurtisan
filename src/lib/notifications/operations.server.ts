import { and, count, desc, eq, isNull } from 'drizzle-orm'
import z from 'zod'
import { db } from '#/db/index'
import { notification, user } from '#/db/schema'
import { enqueueEmail } from '#/lib/email-outbox.server'
import type { EmailTemplate } from '#/lib/email-provider'
import type { EmailCategory } from '#/lib/email-preferences.server'
import { logger } from '#/lib/logger.server'
import { NOTIFICATION_DELIVERY } from './delivery'

export const notificationTypeEnum = z.enum([
  'order_placed',
  'order_shipped',
  'review_received',
  'dispute_opened',
  'dispute_resolved',
  'payout_sent',
  'order_refunded',
  'order_chargeback',
  'dac7_warning_limit',
  'low_stock',
  'shop_moderation_update',
  /**
   * The DSA Article 17 statement of reasons, sent to a review's author when a
   * moderator restricts it. Carries the Article 17(3) elements in `data`.
   */
  'review_moderated',
  /** The Article 16(5) decision notice, sent to whoever reported a review. */
  'review_report_resolved',
])

export type NotificationType = z.infer<typeof notificationTypeEnum>

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue }

export interface NotificationItem {
  id: string
  userId: string
  type: NotificationType
  data: Record<string, SerializableValue>
  readAt: Date | null
  createdAt: Date
}

export interface NotificationsResult {
  notifications: NotificationItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface UnreadCountResult {
  count: number
}

export interface MarkReadResult {
  success: boolean
}

/* -------------------------------------------------------------------------- */
/*                               Create Notification                          */
/* -------------------------------------------------------------------------- */

export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, SerializableValue> = {},
): Promise<NotificationItem> {
  const typeResult = notificationTypeEnum.safeParse(type)
  if (!typeResult.success) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `Invalid notification type: ${type}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [created] = await db
    .insert(notification)
    .values({
      userId,
      type: typeResult.data,
      data,
    })
    .returning()

  // Email delivery is decided by the table, not by whichever call site
  // remembered. `caller_email` types are sent by their flow, which has data the
  // notification payload does not carry; sending here too would double up.
  const delivery = NOTIFICATION_DELIVERY[typeResult.data]
  if (delivery.mode === 'auto_email') {
    await sendNotificationEmail({
      userId,
      template: delivery.template,
      data,
      // Keyed on the notification row, so a retry of the enclosing flow cannot
      // send the same alert twice.
      idempotencyKey: `notification:${created.id}`,
      category: delivery.category,
    })
  }

  return {
    id: created.id,
    userId: created.userId,
    type: created.type,
    data: created.data as Record<string, SerializableValue>,
    readAt: created.readAt,
    createdAt: created.createdAt,
  }
}

/* -------------------------------------------------------------------------- */
/*                            Notification Email                              */
/* -------------------------------------------------------------------------- */

export interface SendNotificationEmailOptions {
  userId: string
  template: EmailTemplate
  data: Record<string, SerializableValue>
  idempotencyKey: string
  category: EmailCategory
}

/**
 * Durable email delivery for a notification recipient.
 *
 * Looks up the user's email address and inserts the email into the outbox.
 * The outbox worker handles rendering, sending, retries, and audit logging.
 * Errors are caught and logged so the enclosing business flow never breaks.
 */
export async function sendNotificationEmail({
  userId,
  template,
  data,
  idempotencyKey,
  category,
}: SendNotificationEmailOptions): Promise<void> {
  try {
    const [userRecord] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!userRecord?.email) {
      logger.warn(`[NotificationEmail] No email found for user ${userId}`)
      return
    }

    await enqueueEmail({
      to: userRecord.email,
      userId,
      template,
      data: {
        ...data,
        buyerName: data.buyerName ?? userRecord.name ?? 'Valued Customer',
      },
      category,
      idempotencyKey,
    })
  } catch (err) {
    logger.error('Notification email enqueue failed', {
      userId,
      template,
      idempotencyKey,
      error: err instanceof Error ? err.message : String(err),
      alert: true,
    })
  }
}

/* -------------------------------------------------------------------------- */
/*                              Get Notifications                             */
/* -------------------------------------------------------------------------- */

export async function getNotificationsQuery(
  userId: string,
  page: number,
  pageSize: number,
): Promise<NotificationsResult> {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))
  const totalPagesResult = await db
    .select({ total: count() })
    .from(notification)
    .where(eq(notification.userId, userId))

  const total = totalPagesResult[0]?.total ?? 0
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)
  const offset = (validatedPage - 1) * validatedPageSize

  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(validatedPageSize)
    .offset(offset)

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      data: row.data as Record<string, SerializableValue>,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
    total,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages,
  }
}

/* -------------------------------------------------------------------------- */
/*                          Unread Notification Count                         */
/* -------------------------------------------------------------------------- */

export async function getUnreadNotificationCountQuery(userId: string): Promise<UnreadCountResult> {
  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))

  return { count: result?.count ?? 0 }
}

/* -------------------------------------------------------------------------- */
/*                            Mark Notification Read                          */
/* -------------------------------------------------------------------------- */

export async function markNotificationReadQuery(
  notificationId: string,
  userId: string,
): Promise<MarkReadResult> {
  // One conditional update rather than select-then-update. Two benefits beyond
  // the round trip: it cannot race with a concurrent read, and it collapses
  // "does not exist" and "belongs to someone else" into one outcome. The old
  // code returned 404 for the first and 403 for the second, which told a caller
  // whether an id they do not own exists.
  const updated = await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.userId, userId),
        isNull(notification.readAt),
      ),
    )
    .returning({ id: notification.id })

  if (updated.length > 0) return { success: true }

  // Nothing was updated: either it was already read — idempotent success — or it
  // is not this user's to read.
  const [own] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .limit(1)

  if (!own) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Notification not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { success: true }
}

/* -------------------------------------------------------------------------- */
/*                         Mark All Notifications Read                        */
/* -------------------------------------------------------------------------- */

export async function markAllNotificationsReadQuery(userId: string): Promise<MarkReadResult> {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))

  return { success: true }
}
