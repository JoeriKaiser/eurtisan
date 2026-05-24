import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, payout, shopOrder, shop, user } from '#/db/schema'

import {
  listPayoutHistoryQuery,
  listPendingPayoutsQuery,
  markPayoutSentQuery,
} from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
  await db.delete(payout)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Creator',
      email: 'creator@example.com',
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPayout(overrides?: Partial<typeof payout.$inferInsert>) {
  return db
    .insert(payout)
    .values({
      shopId: 'shop-1',
      amountCents: 5000,
      status: 'pending',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                        listPendingPayoutsQuery                              */
/* -------------------------------------------------------------------------- */

describe('listPendingPayoutsQuery', () => {
  it('returns empty array when no payouts exist', async () => {
    const result = await listPendingPayoutsQuery()
    expect(result).toEqual([])
  })

  it('returns only pending payouts', async () => {
    await seedUser()
    await seedShop()

    const pending = await seedPayout({ status: 'pending' })
    await seedPayout({ status: 'sent', sentAt: new Date() })

    const result = await listPendingPayoutsQuery()
    expect(result).toHaveLength(1)
    expect(result[0].payoutId).toBe(pending.id)
    expect(result[0].status).toBe('pending')
  })

  it('enriches payouts with creator and shop details', async () => {
    const creator = await seedUser({ id: 'user-c', name: 'Alice' })
    await seedShop({ id: 'shop-s', name: 'Alice Shop', slug: 'alice-shop', ownerId: creator.id })
    await seedPayout({ shopId: 'shop-s', amountCents: 7500 })

    const result = await listPendingPayoutsQuery()
    expect(result).toHaveLength(1)
    expect(result[0].creatorName).toBe('Alice')
    expect(result[0].creatorId).toBe('user-c')
    expect(result[0].shopName).toBe('Alice Shop')
    expect(result[0].shopId).toBe('shop-s')
    expect(result[0].amountCents).toBe(7500)
  })

  it('sorts payouts oldest first so longest-waiting appear at top', async () => {
    await seedUser()
    await seedShop()

    const older = await seedPayout({
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    const newer = await seedPayout({
      status: 'pending',
      createdAt: new Date('2026-06-01T00:00:00Z'),
    })

    const result = await listPendingPayoutsQuery()
    expect(result).toHaveLength(2)
    expect(result[0].payoutId).toBe(older.id)
    expect(result[1].payoutId).toBe(newer.id)
  })

  it('returns payouts from multiple shops and creators', async () => {
    await seedUser({ id: 'user-a', name: 'Creator A', email: 'creator-a@example.com' })
    await seedUser({ id: 'user-b', name: 'Creator B', email: 'creator-b@example.com' })
    await seedShop({ id: 'shop-a', name: 'Shop A', slug: 'shop-a', ownerId: 'user-a' })
    await seedShop({ id: 'shop-b', name: 'Shop B', slug: 'shop-b', ownerId: 'user-b' })
    await seedPayout({ shopId: 'shop-a', amountCents: 1000 })
    await seedPayout({ shopId: 'shop-b', amountCents: 2000 })

    const result = await listPendingPayoutsQuery()
    expect(result).toHaveLength(2)
    const names = result.map((p) => p.creatorName).sort()
    expect(names).toEqual(['Creator A', 'Creator B'])
  })
})

/* -------------------------------------------------------------------------- */
/*                        listPayoutHistoryQuery                               */
/* -------------------------------------------------------------------------- */

describe('listPayoutHistoryQuery', () => {
  it('returns empty result when no payouts exist', async () => {
    const result = await listPayoutHistoryQuery()
    expect(result.payouts).toEqual([])
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
    expect(result.page).toBe(1)
  })

  it('returns all statuses sorted newest first', async () => {
    await seedUser()
    await seedShop()

    const older = await seedPayout({
      status: 'sent',
      sentAt: new Date('2026-01-15T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    const newer = await seedPayout({
      status: 'pending',
      createdAt: new Date('2026-03-01T00:00:00Z'),
    })

    const result = await listPayoutHistoryQuery()
    expect(result.payouts).toHaveLength(2)
    // Newest first
    expect(result.payouts[0].payoutId).toBe(newer.id)
    expect(result.payouts[1].payoutId).toBe(older.id)
    expect(result.total).toBe(2)
  })

  it('supports pagination', async () => {
    await seedUser()
    await seedShop()

    for (let i = 0; i < 5; i++) {
      await seedPayout()
    }

    const page1 = await listPayoutHistoryQuery({ page: 1, pageSize: 2 })
    expect(page1.payouts).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.page).toBe(1)
    expect(page1.totalPages).toBe(3)

    const page2 = await listPayoutHistoryQuery({ page: 2, pageSize: 2 })
    expect(page2.payouts).toHaveLength(2)
    expect(page2.page).toBe(2)

    const page3 = await listPayoutHistoryQuery({ page: 3, pageSize: 2 })
    expect(page3.payouts).toHaveLength(1)
    expect(page3.page).toBe(3)

    // All pages should have distinct payout IDs
    const allIds = [
      ...page1.payouts.map((p) => p.payoutId),
      ...page2.payouts.map((p) => p.payoutId),
      ...page3.payouts.map((p) => p.payoutId),
    ]
    expect(new Set(allIds).size).toBe(5)
  })

  it('defaults to page 1 with pageSize 20', async () => {
    await seedUser()
    await seedShop()
    await seedPayout()

    const result = await listPayoutHistoryQuery()
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('enriches payouts with creator and shop info', async () => {
    await seedUser({ id: 'user-x', name: 'Xavier' })
    await seedShop({ id: 'shop-x', name: 'Xavier Fine Art', slug: 'xavier', ownerId: 'user-x' })
    await seedPayout({ shopId: 'shop-x' })

    const result = await listPayoutHistoryQuery()
    expect(result.payouts).toHaveLength(1)
    expect(result.payouts[0].creatorName).toBe('Xavier')
    expect(result.payouts[0].shopName).toBe('Xavier Fine Art')
  })

  it('includes sentAt field correctly', async () => {
    await seedUser()
    await seedShop()

    const sentDate = new Date('2026-04-01T12:00:00Z')
    await seedPayout({ status: 'sent', sentAt: sentDate })

    const result = await listPayoutHistoryQuery()
    expect(result.payouts[0].sentAt).toEqual(sentDate)
    expect(result.payouts[0].status).toBe('sent')
  })

  it('returns null sentAt for pending payouts', async () => {
    await seedUser()
    await seedShop()

    await seedPayout({ status: 'pending' })

    const result = await listPayoutHistoryQuery()
    expect(result.payouts[0].sentAt).toBeNull()
  })

  it('handles large page sizes up to 100', async () => {
    await seedUser()
    await seedShop()

    for (let i = 0; i < 3; i++) {
      await seedPayout()
    }

    const result = await listPayoutHistoryQuery({ pageSize: 100 })
    expect(result.payouts).toHaveLength(3)
    expect(result.pageSize).toBe(100)
  })
})

/* -------------------------------------------------------------------------- */
/*                        markPayoutSentQuery                                  */
/* -------------------------------------------------------------------------- */

describe('markPayoutSentQuery (idempotency)', () => {
  it('is idempotent — marking already-sent returns success', async () => {
    await seedUser()
    await seedShop()
    const p = await seedPayout({ status: 'sent', sentAt: new Date() })

    const result = await markPayoutSentQuery(p.id)
    expect(result.success).toBe(true)
  })

  it('throws 404 for nonexistent payout', async () => {
    await expect(markPayoutSentQuery('00000000-0000-0000-0000-000000000000')).rejects.toSatisfy(
      (err: unknown) => err instanceof Response && (err as Response).status === 404,
    )
  })
})
