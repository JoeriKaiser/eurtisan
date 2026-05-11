import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import { notification } from '#/db/schema'

export const notificationTypeEnum = z.enum([
  'order_placed',
  'order_shipped',
  'review_received',
  'dispute_opened',
  'payout_sent',
])

export type NotificationType = z.infer<typeof notificationTypeEnum>

export interface NotificationItem {
  id: string
  userId: string
  type: NotificationType
  data: Record<string, unknown>
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
  data: Record<string, unknown> = {},
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
    data: created.data as Record<string, unknown>,
    readAt: created.readAt,
    createdAt: created.createdAt,
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
      data: row.data as Record<string, unknown>,
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
