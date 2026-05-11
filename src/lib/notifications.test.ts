import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { notification, user } from '#/db/schema'

import {
  createNotification,
  getNotificationsQuery,
  getUnreadNotificationCountQuery,
  markAllNotificationsReadQuery,
  markNotificationReadQuery,
} from './notifications.server'

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
  it('returns empty result when no notifications exist', async () => {
    const u = await seedUser()

    const result = await getNotificationsQuery(u.id, 1, 10)
    expect(result.notifications).toEqual([])
    expect(result.total).toBe(0)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(10)
    expect(result.totalPages).toBe(0)
  })

  it('returns notifications ordered by created_at desc', async () => {
    const u = await seedUser()

    await createNotification(u.id, 'order_placed')
    await new Promise((r) => setTimeout(r, 10))
    await createNotification(u.id, 'order_shipped')
    await new Promise((r) => setTimeout(r, 10))
    await createNotification(u.id, 'review_received')

    const result = await getNotificationsQuery(u.id, 1, 10)
    expect(result.notifications).toHaveLength(3)
    expect(result.notifications[0].type).toBe('review_received')
    expect(result.notifications[1].type).toBe('order_shipped')
    expect(result.notifications[2].type).toBe('order_placed')
  })

  it('paginates results correctly', async () => {
    const u = await seedUser()

    for (let i = 0; i < 12; i++) {
      await createNotification(u.id, 'order_placed', { index: i })
    }

    const page1 = await getNotificationsQuery(u.id, 1, 10)
    expect(page1.notifications).toHaveLength(10)
    expect(page1.total).toBe(12)
    expect(page1.totalPages).toBe(2)
    expect(page1.page).toBe(1)

    const page2 = await getNotificationsQuery(u.id, 2, 10)
    expect(page2.notifications).toHaveLength(2)
    expect(page2.page).toBe(2)
  })

  it('does not return notifications for other users', async () => {
    const u1 = await seedUser()
    const u2 = await seedUser({ name: 'Other' })

    await createNotification(u1.id, 'order_placed')
    await createNotification(u2.id, 'review_received')

    const result = await getNotificationsQuery(u1.id, 1, 10)
    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0].type).toBe('order_placed')
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

describe('markNotificationReadQuery', () => {
  it('throws 404 for nonexistent notification', async () => {
    const u = await seedUser()

    try {
      await markNotificationReadQuery('550e8400-e29b-41d4-a716-446655440000', u.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 403 when notification belongs to another user', async () => {
    const u1 = await seedUser()
    const u2 = await seedUser({ name: 'Other' })

    const n = await createNotification(u2.id, 'order_placed')

    try {
      await markNotificationReadQuery(n.id, u1.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('marks a notification as read', async () => {
    const u = await seedUser()

    const n = await createNotification(u.id, 'order_placed')
    expect(n.readAt).toBeNull()

    const result = await markNotificationReadQuery(n.id, u.id)
    expect(result.success).toBe(true)

    const dbRow = await db.select().from(notification).where(eq(notification.id, n.id))
    expect(dbRow[0].readAt).not.toBeNull()
  })

  it('is idempotent when already read', async () => {
    const u = await seedUser()

    const n = await createNotification(u.id, 'order_placed')
    await markNotificationReadQuery(n.id, u.id)

    const result = await markNotificationReadQuery(n.id, u.id)
    expect(result.success).toBe(true)

    const dbRow = await db.select().from(notification).where(eq(notification.id, n.id))
    expect(dbRow[0].readAt).not.toBeNull()
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
