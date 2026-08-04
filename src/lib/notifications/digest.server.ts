import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, sql } from 'drizzle-orm'

import { db } from '#/db/index'
import { notification, user } from '#/db/schema'
import { enqueueEmail } from '#/lib/email-outbox.server'
import { isEmailEnabledForUser } from '#/lib/email-preferences.server'
import { getBaseUrl, getNotificationDigestRecipientBatchSize } from '#/lib/env.server'
import { NOTIFICATION_DELIVERY, type OptionalInAppNotificationType } from './delivery'

const DIGEST_NOTIFICATION_TYPES = [
  'low_stock',
  'review_received',
] as const satisfies readonly OptionalInAppNotificationType[]
const MAX_PRODUCT_NAMES_PER_TYPE = 5
const MAX_PRODUCT_NAME_LENGTH = 160

for (const type of DIGEST_NOTIFICATION_TYPES) {
  if (NOTIFICATION_DELIVERY[type].inApp !== 'optional') {
    throw new Error(`Digest notification type ${type} must remain optional in-app`)
  }
}

export interface DigestWindow {
  day: string
  start: Date
  end: Date
}

export interface NotificationDigestResult {
  recipientsExamined: number
  enqueued: number
  emailPreferenceSkipped: number
}

/** The prior completed UTC calendar day, independent of the host timezone. */
export function getPreviousUtcDayWindow(now = new Date()): DigestWindow {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return { day: start.toISOString().slice(0, 10), start, end }
}

function digestWhere(
  userId: string,
  window: DigestWindow,
  type?: (typeof DIGEST_NOTIFICATION_TYPES)[number],
) {
  return and(
    eq(notification.userId, userId),
    gte(notification.createdAt, window.start),
    lt(notification.createdAt, window.end),
    type ? eq(notification.type, type) : inArray(notification.type, DIGEST_NOTIFICATION_TYPES),
  )
}

async function getDigestRecipients(
  window: DigestWindow,
  afterUserId: string | null,
  limit: number,
) {
  return db
    .selectDistinct({ userId: notification.userId, email: user.email, name: user.name })
    .from(notification)
    .innerJoin(user, eq(notification.userId, user.id))
    .where(
      and(
        gte(notification.createdAt, window.start),
        lt(notification.createdAt, window.end),
        inArray(notification.type, DIGEST_NOTIFICATION_TYPES),
        isNull(user.deletedAt),
        afterUserId ? gt(notification.userId, afterUserId) : undefined,
      ),
    )
    .orderBy(asc(notification.userId))
    .limit(limit)
}

function boundedProductName(data: unknown): string[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return []
  const productName = (data as Record<string, unknown>).productName
  if (typeof productName !== 'string' || !productName.trim()) return []
  return [productName.trim().slice(0, MAX_PRODUCT_NAME_LENGTH)]
}

async function getDigestData(userId: string, window: DigestWindow) {
  const [countRows, lowStockRows, reviewRows] = await Promise.all([
    db
      .select({ type: notification.type, count: sql<number>`count(*)::integer` })
      .from(notification)
      .where(digestWhere(userId, window))
      .groupBy(notification.type),
    db
      .select({ data: notification.data })
      .from(notification)
      .where(digestWhere(userId, window, 'low_stock'))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(MAX_PRODUCT_NAMES_PER_TYPE),
    db
      .select({ data: notification.data })
      .from(notification)
      .where(digestWhere(userId, window, 'review_received'))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(MAX_PRODUCT_NAMES_PER_TYPE),
  ])

  const counts = new Map(countRows.map((row) => [row.type, Number(row.count)]))
  const lowStockProductNames = lowStockRows.flatMap((row) => boundedProductName(row.data))
  const reviewProductNames = reviewRows.flatMap((row) => boundedProductName(row.data))

  return {
    lowStockCount: counts.get('low_stock') ?? 0,
    reviewCount: counts.get('review_received') ?? 0,
    lowStockProductNames,
    reviewProductNames,
  }
}

/**
 * Aggregate every eligible seller from the prior UTC day. Recipient IDs are
 * paged; event payload reads are capped to five product names per type.
 */
export async function enqueuePreviousUtcDayDigests(
  now = new Date(),
  recipientBatchSize = getNotificationDigestRecipientBatchSize(),
): Promise<NotificationDigestResult> {
  const window = getPreviousUtcDayWindow(now)
  let afterUserId: string | null = null
  let recipientsExamined = 0
  let enqueued = 0
  let emailPreferenceSkipped = 0

  while (true) {
    const recipients = await getDigestRecipients(window, afterUserId, recipientBatchSize)
    if (recipients.length === 0) break

    for (const recipient of recipients) {
      recipientsExamined += 1
      if (!(await isEmailEnabledForUser(recipient.userId, 'seller_updates'))) {
        emailPreferenceSkipped += 1
        continue
      }

      const digest = await getDigestData(recipient.userId, window)
      if (digest.lowStockCount + digest.reviewCount === 0) continue

      const result = await enqueueEmail({
        to: recipient.email,
        userId: recipient.userId,
        template: 'notification_digest',
        category: 'seller_updates',
        idempotencyKey: `notification-digest:${recipient.userId}:${window.day}`,
        locale: 'en',
        data: {
          sellerName: recipient.name.slice(0, MAX_PRODUCT_NAME_LENGTH),
          date: window.day,
          ...digest,
          notificationsUrl: `${getBaseUrl()}/notifications`,
        },
      })
      if (!result.alreadyExists) enqueued += 1
    }

    afterUserId = recipients[recipients.length - 1]?.userId ?? null
    if (recipients.length < recipientBatchSize) break
  }

  return { recipientsExamined, enqueued, emailPreferenceSkipped }
}
