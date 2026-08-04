import { and, count, desc, eq, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm'
import z from 'zod'
import { db } from '#/db/index'
import { notification, user, userNotificationPreference } from '#/db/schema'
import { enqueueEmail } from '#/lib/email-outbox.server'
import type { EmailTemplate } from '#/lib/email-provider'
import type { EmailCategory } from '#/lib/email-preferences.server'
import { logger } from '#/lib/logger.server'
import { NOTIFICATION_DELIVERY } from './delivery'
import { getDisabledInAppNotificationTypes } from './preferences.server'

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
  /** A seller has published their official reply to the buyer's review. */
  'seller_reply_received',
  /**
   * The DSA Article 17 statement of reasons, sent to the seller who authored a
   * reply when a moderator restricts it. Carries the Article 17(3) elements.
   */
  'seller_reply_moderated',
  /** The Article 16(5) decision notice, sent to whoever reported a seller reply. */
  'seller_reply_report_resolved',
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

export interface NotificationGroup {
  key: string
  type: NotificationType
  /** Capped to the most recent events; `count`/`unreadCount` cover the full group. */
  items: NotificationItem[]
  count: number
  unreadCount: number
  createdAt: Date
}

export interface NotificationsResult {
  groups: NotificationGroup[]
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

  const createdAt = new Date()
  const delivery = NOTIFICATION_DELIVERY[typeResult.data]
  const [created] = await db.transaction(async (tx) => {
    // Preference changes lock the same user row. That serialization prevents an
    // event from slipping in unread between disabling its type and mark-read.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update').limit(1)

    const readAt =
      delivery.inApp === 'optional'
        ? (
            await tx
              .select({ enabled: userNotificationPreference.enabled })
              .from(userNotificationPreference)
              .where(
                and(
                  eq(userNotificationPreference.userId, userId),
                  eq(userNotificationPreference.type, typeResult.data),
                ),
              )
              .limit(1)
          )[0]?.enabled === false
          ? createdAt
          : null
        : null
    const groupKey =
      typeResult.data === 'low_stock' || typeResult.data === 'review_received'
        ? `daily:${typeResult.data}:${createdAt.toISOString().slice(0, 10)}`
        : null

    return tx
      .insert(notification)
      .values({
        userId,
        type: typeResult.data,
        data,
        groupKey,
        readAt,
        createdAt,
      })
      .returning()
  })

  // Email delivery is decided by the table, not by whichever call site
  // remembered. `caller_email` types are sent by their flow, which has data the
  // notification payload does not carry; sending here too would double up.
  // `delivery` was resolved before the insert so its in-app policy determines
  // whether an optional event is born read.
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

/**
 * Most recent event rows returned per group on a list page. `count` and
 * `unreadCount` are SQL aggregates over the full group; capping `items` keeps
 * a burst day (hundreds of low-stock events) from bloating the page payload.
 * The daily digest email carries the day's complete summary.
 */
const MAX_GROUP_ITEMS = 20

export async function getNotificationsQuery(
  userId: string,
  page: number,
  pageSize: number,
): Promise<NotificationsResult> {
  const disabledTypes = await getDisabledInAppNotificationTypes(userId)
  const conditions = [eq(notification.userId, userId)]
  if (disabledTypes.length > 0) {
    conditions.push(notInArray(notification.type, disabledTypes))
  }
  const where = and(...conditions)
  const groupIdentity = sql<string>`coalesce(${notification.groupKey}, ${notification.id}::text)`
  const latestCreatedAt = sql<Date>`max(${notification.createdAt})`.mapWith(notification.createdAt)

  const validatedPageSize = Math.min(100, Math.max(1, pageSize))
  const [totalResult, unpagedGroups] = await Promise.all([
    db
      .select({ total: sql<number>`count(distinct ${groupIdentity})::int` })
      .from(notification)
      .where(where),
    db
      .select({
        key: groupIdentity,
        type: sql<NotificationType>`min(${notification.type}::text)`,
        createdAt: latestCreatedAt,
      })
      .from(notification)
      .where(where)
      .groupBy(groupIdentity)
      .orderBy(desc(latestCreatedAt), desc(groupIdentity))
      .limit(validatedPageSize)
      .offset((Math.max(1, page) - 1) * validatedPageSize),
  ])

  const total = totalResult[0]?.total ?? 0
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)

  // Re-run the page query only when the requested page needed clamping. This
  // keeps SQL pagination exact without ever fetching the unpaginated event set.
  const pagedGroups =
    validatedPage === Math.max(1, page)
      ? unpagedGroups
      : await db
          .select({
            key: groupIdentity,
            type: sql<NotificationType>`min(${notification.type}::text)`,
            createdAt: latestCreatedAt,
          })
          .from(notification)
          .where(where)
          .groupBy(groupIdentity)
          .orderBy(desc(latestCreatedAt), desc(groupIdentity))
          .limit(validatedPageSize)
          .offset((validatedPage - 1) * validatedPageSize)

  if (pagedGroups.length === 0) {
    return {
      groups: [],
      total,
      page: validatedPage,
      pageSize: validatedPageSize,
      totalPages,
    }
  }

  const groupKeys = pagedGroups.map((group) => group.key)
  const groupFilter = and(where, inArray(groupIdentity, groupKeys))
  const itemRank = sql<number>`row_number() over (
    partition by ${groupIdentity}
    order by ${notification.createdAt} desc, ${notification.id} desc
  )`.as('item_rank')

  // `count`/`unreadCount` aggregate the full group in SQL; `items` is capped to
  // the most recent events so a burst day cannot bloat the page payload.
  const ranked = db
    .select({ id: notification.id, rank: itemRank })
    .from(notification)
    .where(groupFilter)
    .as('ranked_group_items')

  const [statsRows, rows] = await Promise.all([
    db
      .select({
        key: groupIdentity,
        count: sql<number>`count(*)::int`,
        unreadCount: sql<number>`count(*) filter (where ${notification.readAt} is null)::int`,
      })
      .from(notification)
      .where(groupFilter)
      .groupBy(groupIdentity),
    db
      .select({
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        groupKey: notification.groupKey,
        data: notification.data,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })
      .from(ranked)
      .innerJoin(notification, eq(notification.id, ranked.id))
      .where(lte(ranked.rank, MAX_GROUP_ITEMS))
      .orderBy(desc(notification.createdAt), desc(notification.id)),
  ])

  const statsByGroupKey = new Map(statsRows.map((row) => [row.key, row]))
  const itemsByGroupKey = new Map<string, NotificationItem[]>()
  for (const row of rows) {
    const key = row.groupKey ?? row.id
    const items = itemsByGroupKey.get(key)
    const item = {
      id: row.id,
      userId: row.userId,
      type: row.type,
      data: row.data as Record<string, SerializableValue>,
      readAt: row.readAt,
      createdAt: row.createdAt,
    }
    if (items) {
      items.push(item)
    } else {
      itemsByGroupKey.set(key, [item])
    }
  }

  return {
    groups: pagedGroups.map((group) => {
      const items = itemsByGroupKey.get(group.key) ?? []
      const stats = statsByGroupKey.get(group.key)
      return {
        key: group.key,
        type: group.type,
        items,
        count: stats?.count ?? items.length,
        unreadCount: stats?.unreadCount ?? 0,
        createdAt: group.createdAt,
      }
    }),
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
  const disabledTypes = await getDisabledInAppNotificationTypes(userId)
  const conditions = [eq(notification.userId, userId), isNull(notification.readAt)]
  if (disabledTypes.length > 0) {
    conditions.push(notInArray(notification.type, disabledTypes))
  }

  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(and(...conditions))

  return { count: result?.count ?? 0 }
}

/* -------------------------------------------------------------------------- */
/*                           Mark Notifications Read                          */
/* -------------------------------------------------------------------------- */

export async function markNotificationsReadQuery(
  notificationIds: string[],
  userId: string,
): Promise<MarkReadResult> {
  // Scope the update to the authenticated owner and return the same success
  // result whether requested IDs are absent, foreign, or already read.
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        inArray(notification.id, notificationIds),
        isNull(notification.readAt),
      ),
    )

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
