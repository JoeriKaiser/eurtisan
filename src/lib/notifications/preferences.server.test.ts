import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { auditLog, notification, userNotificationPreference } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'

import { createNotification } from './operations.server'
import {
  getInAppNotificationPreferences,
  isInAppNotificationEnabled,
  updateInAppNotificationPreference,
} from './preferences.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('in-app notification preferences', () => {
  it('returns the enabled defaults without creating preference rows', async () => {
    const user = await createUser()

    await expect(getInAppNotificationPreferences(user.id)).resolves.toEqual([
      {
        type: 'low_stock',
        enabled: true,
        labelKey: 'account_in_app_preference_low_stock',
        descriptionKey: 'account_in_app_preference_low_stock_description',
      },
      {
        type: 'review_received',
        enabled: true,
        labelKey: 'account_in_app_preference_review_received',
        descriptionKey: 'account_in_app_preference_review_received_description',
      },
      {
        type: 'seller_reply_received',
        enabled: true,
        labelKey: 'account_in_app_preference_seller_reply_received',
        descriptionKey: 'account_in_app_preference_seller_reply_received_description',
      },
    ])

    const rows = await db
      .select()
      .from(userNotificationPreference)
      .where(eq(userNotificationPreference.userId, user.id))
    expect(rows).toHaveLength(0)
  })

  it('disables transactionally, marks existing unread events read, and audit logs it', async () => {
    const user = await createUser()
    const existing = await createNotification(user.id, 'low_stock', { productId: 'product-1' })

    await updateInAppNotificationPreference(user.id, 'low_stock', false)

    const [preference] = await db
      .select()
      .from(userNotificationPreference)
      .where(
        and(
          eq(userNotificationPreference.userId, user.id),
          eq(userNotificationPreference.type, 'low_stock'),
        ),
      )
    const [updated] = await db.select().from(notification).where(eq(notification.id, existing.id))
    const [log] = await db.select().from(auditLog).where(eq(auditLog.actorId, user.id))

    expect(preference?.enabled).toBe(false)
    expect(updated?.readAt).toBeInstanceOf(Date)
    expect(log).toMatchObject({
      action: 'notification_preference_updated',
      resourceType: 'user_notification_preference',
      metadata: { type: 'low_stock', enabled: false },
    })
  })

  it('stores disabled future optional events as read with their daily UTC group key', async () => {
    const user = await createUser()
    await updateInAppNotificationPreference(user.id, 'review_received', false)

    const created = await createNotification(user.id, 'review_received', { reviewId: 'review-1' })
    const [stored] = await db.select().from(notification).where(eq(notification.id, created.id))

    expect(created.readAt).toBeInstanceOf(Date)
    expect(stored?.readAt).toBeInstanceOf(Date)
    expect(stored?.groupKey).toBe(
      `daily:review_received:${stored?.createdAt.toISOString().slice(0, 10)}`,
    )
  })

  it('leaves seller replies ungrouped even though their in-app delivery is optional', async () => {
    const user = await createUser()

    const created = await createNotification(user.id, 'seller_reply_received', {
      replyId: 'reply-1',
    })
    const [stored] = await db.select().from(notification).where(eq(notification.id, created.id))

    expect(stored?.groupKey).toBeNull()
  })

  it('never allows required notifications to be disabled and does not create a preference row', async () => {
    const user = await createUser()

    await expect(
      updateInAppNotificationPreference(user.id, 'order_refunded', false),
    ).rejects.toMatchObject({
      status: 400,
    })
    expect(await isInAppNotificationEnabled(user.id, 'order_refunded')).toBe(true)

    const rows = await db
      .select()
      .from(userNotificationPreference)
      .where(eq(userNotificationPreference.userId, user.id))
    expect(rows).toHaveLength(0)
  })

  it('does not make old notifications unread when re-enabled', async () => {
    const user = await createUser()
    await updateInAppNotificationPreference(user.id, 'seller_reply_received', false)
    const created = await createNotification(user.id, 'seller_reply_received')

    await updateInAppNotificationPreference(user.id, 'seller_reply_received', true)

    const [stored] = await db.select().from(notification).where(eq(notification.id, created.id))
    expect(stored?.readAt).toBeInstanceOf(Date)
    expect(await isInAppNotificationEnabled(user.id, 'seller_reply_received')).toBe(true)
  })
})
