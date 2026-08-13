import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { emailOutbox, notification } from '#/db/schema'
import { updateEmailPreference } from '#/lib/email-preferences.server'
import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'

import { enqueuePreviousUtcDayDigests, getPreviousUtcDayWindow } from './digest.server'

const RUN_AT = new Date('2026-06-02T12:00:00.000Z')
const PREVIOUS_DAY = new Date('2026-06-01T12:00:00.000Z')

function requireData(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected email outbox data object')
  }
  return value as Record<string, unknown>
}

async function addNotification(
  userId: string,
  type: 'low_stock' | 'review_received' | 'order_placed' | 'seller_reply_received',
  productName: string,
): Promise<void> {
  await db.insert(notification).values({
    userId,
    type,
    data: { productName },
    createdAt: PREVIOUS_DAY,
  })
}

beforeEach(clearTestTables)
afterEach(clearTestTables)

describe('getPreviousUtcDayWindow', () => {
  it('uses the completed UTC day rather than the host timezone', () => {
    const window = getPreviousUtcDayWindow(new Date('2026-06-02T00:01:00.000Z'))

    expect(window.day).toBe('2026-06-01')
    expect(window.start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-06-02T00:00:00.000Z')
  })
})

describe('enqueuePreviousUtcDayDigests', () => {
  it('aggregates only a seller’s eligible events and remains idempotent', async () => {
    const seller = await createUser({ name: 'Maaike' })
    const otherSeller = await createUser({ name: 'Other seller' })
    await addNotification(seller.id, 'low_stock', 'Vase')
    await addNotification(seller.id, 'low_stock', 'Bowl')
    await addNotification(seller.id, 'review_received', 'Mug')
    await addNotification(otherSeller.id, 'review_received', 'Other product')

    const first = await enqueuePreviousUtcDayDigests(RUN_AT, 1)
    const second = await enqueuePreviousUtcDayDigests(RUN_AT, 1)

    expect(first.enqueued).toBe(2)
    expect(second.enqueued).toBe(0)

    const sellerRow = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, `notification-digest:${seller.id}:2026-06-01`),
    })
    expect(sellerRow?.category).toBe('seller_updates')
    expect(sellerRow?.template).toBe('notification_digest')
    expect(sellerRow?.data).toMatchObject({
      sellerName: 'Maaike',
      lowStockCount: 2,
      reviewCount: 1,
      reviewProductNames: ['Mug'],
      notificationsUrl: expect.stringMatching(/\/notifications$/),
    })
    expect(requireData(sellerRow?.data).lowStockProductNames).toEqual(
      expect.arrayContaining(['Bowl', 'Vase']),
    )
    expect(sellerRow?.data).not.toMatchObject({ reviewProductNames: ['Other product'] })

    const rows = await db.select().from(emailOutbox)
    expect(rows).toHaveLength(2)
  })

  it('bounds product-name payloads while preserving the total event count', async () => {
    const seller = await createUser()
    for (let index = 0; index < 6; index += 1) {
      await addNotification(seller.id, 'low_stock', `Product ${index} ${'x'.repeat(300)}`)
    }

    await enqueuePreviousUtcDayDigests(RUN_AT)

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, `notification-digest:${seller.id}:2026-06-01`),
    })
    const data = requireData(row?.data)
    expect(data.lowStockCount).toBe(6)
    expect(data.lowStockProductNames).toHaveLength(5)
    const names = data.lowStockProductNames
    expect(
      Array.isArray(names) && names.every((name) => typeof name === 'string' && name.length <= 160),
    ).toBe(true)
  })

  it('does not enqueue for disabled seller updates or deleted recipients', async () => {
    const optedOutSeller = await createUser()
    const deletedSeller = await createUser({ deletedAt: new Date() })
    await addNotification(optedOutSeller.id, 'low_stock', 'Vase')
    await addNotification(deletedSeller.id, 'review_received', 'Bowl')
    await updateEmailPreference(optedOutSeller.id, 'seller_updates', false)

    const result = await enqueuePreviousUtcDayDigests(RUN_AT)

    expect(result.emailPreferenceSkipped).toBe(1)
    expect(result.enqueued).toBe(0)
    expect(await db.select().from(emailOutbox)).toHaveLength(0)
  })

  it('does not create an outbox row when the day has no eligible events', async () => {
    const seller = await createUser()
    await addNotification(seller.id, 'order_placed', 'Unrelated order')
    await addNotification(seller.id, 'seller_reply_received', 'Buyer-facing reply')
    await db.insert(notification).values({
      userId: seller.id,
      type: 'review_received',
      data: { productName: 'Today only' },
      createdAt: RUN_AT,
    })

    const result = await enqueuePreviousUtcDayDigests(RUN_AT)

    expect(result.enqueued).toBe(0)
    expect(await db.select().from(emailOutbox)).toHaveLength(0)
  })
})
