import { and, count, desc, eq, isNull } from 'drizzle-orm'
import z from 'zod'
import { db } from '#/db/index'
import { notification, user } from '#/db/schema'
import { enqueueEmail } from '#/lib/email-outbox.server'
import type { EmailTemplate } from '#/lib/email-provider'
import type { EmailCategory } from '#/lib/email-preferences.server'
import { logger } from '#/lib/logger.server'

export const notificationTypeEnum = z.enum([
  'order_placed',
  'order_shipped',
  'review_received',
  'dispute_opened',
  'dispute_resolved',
  'payout_sent',
  'order_refunded',
  'dac7_warning_limit',
  'low_stock',
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

  return {
    id: created.id,
    userId: created.userId,
    type: created.type as NotificationType,
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
      type: row.type as NotificationType,
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
  const [existing] = await db
    .select()
    .from(notification)
    .where(eq(notification.id, notificationId))
    .limit(1)

  if (!existing) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Notification not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (existing.userId !== userId) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (existing.readAt) {
    return { success: true }
  }

  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(eq(notification.id, notificationId))

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
