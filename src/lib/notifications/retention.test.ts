import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { notification, user } from '#/db/schema'
import { createNotification } from '../notifications.server'
import { purgeOldNotifications } from './retention.server'

beforeEach(async () => {
  await db.delete(notification)
})

afterAll(async () => {
  await db.delete(notification)
})

async function seedUser() {
  const id = crypto.randomUUID()
  return db
    .insert(user)
    .values({ id, name: 'Test', email: `${id}@example.com`, emailVerified: true })
    .returning()
    .then((rows) => rows[0])
}

/** Backdates both timestamps, since the clock runs on `readAt`. */
async function markReadAt(id: string, readAt: Date) {
  await db.update(notification).set({ readAt, createdAt: readAt }).where(eq(notification.id, id))
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

describe('purgeOldNotifications', () => {
  it('deletes read notifications past the retention period', async () => {
    const u = await seedUser()
    const old = await createNotification(u.id, 'order_placed')
    await markReadAt(old.id, daysAgo(400))

    const result = await purgeOldNotifications(365)

    expect(result.deleted).toBe(1)
    expect(await db.select().from(notification).where(eq(notification.id, old.id))).toHaveLength(0)
  })

  it('never deletes an unread notification, however old', async () => {
    // The point of the whole job. An unread notification is undelivered
    // information — a chargeback nobody saw, a statement of reasons nobody
    // opened — and age is not consent to forget it.
    const u = await seedUser()
    const ancient = await createNotification(u.id, 'order_chargeback')
    await db
      .update(notification)
      .set({ createdAt: daysAgo(3000) })
      .where(eq(notification.id, ancient.id))

    const result = await purgeOldNotifications(365)

    expect(result.deleted).toBe(0)
    expect(
      await db.select().from(notification).where(eq(notification.id, ancient.id)),
    ).toHaveLength(1)
  })

  it('keeps read notifications inside the window', async () => {
    const u = await seedUser()
    const recent = await createNotification(u.id, 'order_placed')
    await markReadAt(recent.id, daysAgo(10))

    expect((await purgeOldNotifications(365)).deleted).toBe(0)
  })

  it('measures age from when it was read, not when it arrived', async () => {
    // A notification created two years ago but read yesterday is one day into
    // its retention, not two years. Using `createdAt` would delete it.
    const u = await seedUser()
    const n = await createNotification(u.id, 'order_placed')
    await db
      .update(notification)
      .set({ createdAt: daysAgo(730), readAt: daysAgo(1) })
      .where(eq(notification.id, n.id))

    expect((await purgeOldNotifications(365)).deleted).toBe(0)
  })
})
