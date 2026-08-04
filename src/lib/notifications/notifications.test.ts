import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { notification, user, userNotificationPreference } from '#/db/schema'

import {
  createNotification,
  getNotificationsQuery,
  getUnreadNotificationCountQuery,
  markAllNotificationsReadQuery,
  markNotificationsReadQuery,
} from '../notifications.server'

beforeEach(async () => {
  await db.delete(notification)
})

afterAll(async () => {
  await db.delete(notification)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  const id = overrides?.id ?? crypto.randomUUID()
  const existing = await db.select().from(user).where(eq(user.id, id)).limit(1)
  if (existing.length > 0) {
    return existing[0]
  }

  return db
    .insert(user)
    .values({
      id,
      name: 'Test',
      email: `${id}@example.com`,
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

describe('createNotification', () => {
  it('creates a notification with valid type and data', async () => {
    const u = await seedUser()

    const result = await createNotification(u.id, 'order_placed', { orderId: 'order-1' })

    expect(result.userId).toBe(u.id)
    expect(result.type).toBe('order_placed')
    expect(result.data).toEqual({ orderId: 'order-1' })
    expect(result.readAt).toBeNull()
    expect(result.createdAt).toBeDefined()

    const dbRow = await db.select().from(notification).where(eq(notification.id, result.id))
    expect(dbRow).toHaveLength(1)
    expect(dbRow[0].type).toBe('order_placed')
  })

  it('creates a notification with empty data by default', async () => {
    const u = await seedUser()

    const result = await createNotification(u.id, 'review_received')

    expect(result.data).toEqual({})
  })

  it('accepts all valid notification types', async () => {
    const u = await seedUser()

    const types = [
      'order_placed',
      'order_shipped',
      'review_received',
      'dispute_opened',
      'payout_sent',
    ] as const

    for (const type of types) {
      const result = await createNotification(u.id, type)
      expect(result.type).toBe(type)
    }

    const rows = await db.select().from(notification).where(eq(notification.userId, u.id))
    expect(rows).toHaveLength(5)
  })

  it('throws 400 for invalid notification type', async () => {
    const u = await seedUser()

    try {
      await createNotification(u.id, 'invalid_type' as never)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })
})

describe('getNotificationsQuery', () => {
  it('returns empty groups when no notifications exist', async () => {
    const u = await seedUser()

    const result = await getNotificationsQuery(u.id, 1, 10)
    expect(result.groups).toEqual([])
    expect(result.total).toBe(0)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(10)
    expect(result.totalPages).toBe(0)
  })

  it('groups daily rows, preserves single rows, and splits adjacent UTC days', async () => {
    const u = await seedUser()
    const dayOneKey = 'daily:review_received:2026-08-01'
    const dayTwoKey = 'daily:review_received:2026-08-02'

    await db.insert(notification).values([
      {
        userId: u.id,
        type: 'review_received',
        groupKey: dayOneKey,
        data: { index: 1 },
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
      },
      {
        userId: u.id,
        type: 'review_received',
        groupKey: dayOneKey,
        data: { index: 2 },
        createdAt: new Date('2026-08-01T13:00:00.000Z'),
      },
      {
        userId: u.id,
        type: 'review_received',
        groupKey: dayTwoKey,
        data: { index: 3 },
        createdAt: new Date('2026-08-02T12:00:00.000Z'),
      },
      {
        userId: u.id,
        type: 'seller_reply_received',
        data: { index: 4 },
        createdAt: new Date('2026-08-02T13:00:00.000Z'),
      },
      {
        userId: u.id,
        type: 'seller_reply_received',
        data: { index: 5 },
        createdAt: new Date('2026-08-02T14:00:00.000Z'),
      },
    ])

    const result = await getNotificationsQuery(u.id, 1, 10)

    expect(result.total).toBe(4)
    expect(result.groups.map((group) => group.key)).toEqual([
      expect.any(String),
      expect.any(String),
      dayTwoKey,
      dayOneKey,
    ])
    expect(result.groups[3]).toMatchObject({
      key: dayOneKey,
      count: 2,
      unreadCount: 2,
      type: 'review_received',
    })
    expect(result.groups[3].items.map((item) => item.data.index)).toEqual([2, 1])
    expect(result.groups.find((group) => group.key === dayTwoKey)?.createdAt.toISOString()).toBe(
      '2026-08-02T12:00:00.000Z',
    )
    expect(result.groups[0].count).toBe(1)
    expect(result.groups[1].count).toBe(1)
    expect(result.groups[0].key).not.toBe(result.groups[1].key)
  })

  it('paginates complete groups with deterministic latest/key tie ordering', async () => {
    const u = await seedUser()
    const createdAt = new Date('2026-08-02T12:00:00.000Z')
    const reviewKey = 'daily:review_received:2026-08-02'
    const stockKey = 'daily:low_stock:2026-08-02'

    await db.insert(notification).values([
      {
        userId: u.id,
        type: 'review_received',
        groupKey: reviewKey,
        data: { index: 1 },
        createdAt,
      },
      {
        userId: u.id,
        type: 'review_received',
        groupKey: reviewKey,
        data: { index: 2 },
        createdAt: new Date('2026-08-02T11:00:00.000Z'),
      },
      {
        userId: u.id,
        type: 'low_stock',
        groupKey: stockKey,
        data: { index: 3 },
        createdAt,
      },
    ])

    const pageOne = await getNotificationsQuery(u.id, 1, 1)
    const pageTwo = await getNotificationsQuery(u.id, 2, 1)

    expect(pageOne.total).toBe(2)
    expect(pageOne.totalPages).toBe(2)
    expect(pageOne.groups).toHaveLength(1)
    expect(pageOne.groups[0]).toMatchObject({ key: reviewKey, count: 2 })
    expect(pageOne.groups[0].items.map((item) => item.data.index)).toEqual([1, 2])
    expect(pageTwo.groups).toHaveLength(1)
    expect(pageTwo.groups[0]).toMatchObject({ key: stockKey, count: 1 })
  })

  it('caps returned items per group while counting the full group in SQL', async () => {
    const u = await seedUser()
    const stockKey = 'daily:low_stock:2026-08-02'

    await db.insert(notification).values(
      Array.from({ length: 25 }, (_, index) => ({
        userId: u.id,
        type: 'low_stock' as const,
        groupKey: stockKey,
        data: { index: index + 1 },
        createdAt: new Date(`2026-08-02T10:00:00.000Z`),
      })),
    )
    const [firstRow] = await db
      .select({ id: notification.id })
      .from(notification)
      .where(eq(notification.userId, u.id))
      .limit(1)
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(eq(notification.id, firstRow.id))

    const result = await getNotificationsQuery(u.id, 1, 10)

    expect(result.groups).toHaveLength(1)
    const group = result.groups[0]
    expect(group.count).toBe(25)
    expect(group.unreadCount).toBe(24)
    expect(group.items).toHaveLength(20)
  })

  it('does not return groups for other users', async () => {
    const u1 = await seedUser()
    const u2 = await seedUser({ name: 'Other' })

    await createNotification(u1.id, 'order_placed')
    await createNotification(u2.id, 'review_received')

    const result = await getNotificationsQuery(u1.id, 1, 10)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].type).toBe('order_placed')
  })

  it('excludes disabled optional types from groups and the unread badge', async () => {
    const u = await seedUser()
    await db.insert(userNotificationPreference).values({
      userId: u.id,
      type: 'review_received',
      enabled: false,
    })
    await createNotification(u.id, 'review_received')
    await createNotification(u.id, 'order_placed')

    const [result, unread] = await Promise.all([
      getNotificationsQuery(u.id, 1, 10),
      getUnreadNotificationCountQuery(u.id),
    ])

    expect(result.groups.map((group) => group.type)).toEqual(['order_placed'])
    expect(unread.count).toBe(1)
  })

  it('validates page and pageSize boundaries', async () => {
    const u = await seedUser()

    const result = await getNotificationsQuery(u.id, 0, 0)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(1)
  })
})

describe('getUnreadNotificationCountQuery', () => {
  it('returns 0 when no notifications exist', async () => {
    const u = await seedUser()

    const result = await getUnreadNotificationCountQuery(u.id)
    expect(result.count).toBe(0)
  })

  it('returns count of only unread notifications', async () => {
    const u = await seedUser()

    const n1 = await createNotification(u.id, 'order_placed')
    await createNotification(u.id, 'order_shipped')
    await createNotification(u.id, 'review_received')

    // Mark one as read
    await db.update(notification).set({ readAt: new Date() }).where(eq(notification.id, n1.id))

    const result = await getUnreadNotificationCountQuery(u.id)
    expect(result.count).toBe(2)
  })

  it('does not count notifications for other users', async () => {
    const u1 = await seedUser()
    const u2 = await seedUser({ name: 'Other' })

    await createNotification(u1.id, 'order_placed')
    await createNotification(u2.id, 'order_shipped')

    const result = await getUnreadNotificationCountQuery(u1.id)
    expect(result.count).toBe(1)
  })
})

describe('markNotificationsReadQuery', () => {
  it('marks only owned requested notifications and does not disclose foreign or missing IDs', async () => {
    const owner = await seedUser()
    const otherUser = await seedUser({ name: 'Other' })
    const owned = await createNotification(owner.id, 'order_placed')
    const other = await createNotification(otherUser.id, 'order_shipped')
    const missing = '550e8400-e29b-41d4-a716-446655440000'

    const result = await markNotificationsReadQuery([owned.id, other.id, missing], owner.id)

    expect(result).toEqual({ success: true })
    const [ownedRow] = await db.select().from(notification).where(eq(notification.id, owned.id))
    const [otherRow] = await db.select().from(notification).where(eq(notification.id, other.id))
    expect(ownedRow.readAt).not.toBeNull()
    expect(otherRow.readAt).toBeNull()
  })

  it('is idempotent for already-read notifications', async () => {
    const u = await seedUser()
    const n = await createNotification(u.id, 'order_placed')

    await markNotificationsReadQuery([n.id], u.id)
    const result = await markNotificationsReadQuery([n.id], u.id)

    expect(result).toEqual({ success: true })
  })
})

describe('markAllNotificationsReadQuery', () => {
  it('marks all unread notifications as read for the user', async () => {
    const u = await seedUser()

    await createNotification(u.id, 'order_placed')
    await createNotification(u.id, 'order_shipped')
    await createNotification(u.id, 'review_received')

    const before = await getUnreadNotificationCountQuery(u.id)
    expect(before.count).toBe(3)

    const result = await markAllNotificationsReadQuery(u.id)
    expect(result.success).toBe(true)

    const after = await getUnreadNotificationCountQuery(u.id)
    expect(after.count).toBe(0)
  })

  it('does not affect other users notifications', async () => {
    const u1 = await seedUser()
    const u2 = await seedUser({ name: 'Other' })

    await createNotification(u1.id, 'order_placed')
    await createNotification(u2.id, 'order_shipped')

    await markAllNotificationsReadQuery(u1.id)

    const user2Unread = await getUnreadNotificationCountQuery(u2.id)
    expect(user2Unread.count).toBe(1)
  })

  it('succeeds when no unread notifications exist', async () => {
    const u = await seedUser()

    const result = await markAllNotificationsReadQuery(u.id)
    expect(result.success).toBe(true)
  })
})
