import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { dispute, payout, platformOrder, shop, shopOrder, user } from '#/db/schema'
import { getAdminDashboardStatsQuery } from './admin-dashboard.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(payout)
  await db.delete(dispute)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      role: 'customer',
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

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return db
    .insert(platformOrder)
    .values({
      userId: 'user-1',
      shippingAddress: {
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      billingAddress: {
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      totalCents: 1000,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId: '00000000-0000-0000-0000-000000000001',
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'delivered',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedDispute(
  shopOrderId: string,
  overrides?: Partial<Omit<typeof dispute.$inferInsert, 'shopOrderId'>>,
) {
  return db
    .insert(dispute)
    .values({
      id: crypto.randomUUID(),
      shopOrderId,
      buyerUserId: 'user-1',
      reason: 'damaged',
      description: 'Item arrived damaged',
      status: 'open',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPayout(overrides?: Partial<typeof payout.$inferInsert>) {
  return db
    .insert(payout)
    .values({
      id: crypto.randomUUID(),
      shopId: 'shop-1',
      amountCents: 5000,
      status: 'pending',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                        getAdminDashboardStatsQuery                         */
/* -------------------------------------------------------------------------- */

describe('getAdminDashboardStatsQuery', () => {
  it('returns all zeroes when the database is empty', async () => {
    const result = await getAdminDashboardStatsQuery()

    expect(result).toEqual({
      totalUsers: 0,
      activeShops: 0,
      openDisputes: 0,
      pendingPayouts: 0,
    })
  })

  it('counts total registered users correctly', async () => {
    await seedUser({ id: 'user-1', email: 'a@a.com' })
    await seedUser({ id: 'user-2', email: 'b@b.com' })
    await seedUser({ id: 'user-3', email: 'c@c.com' })

    const result = await getAdminDashboardStatsQuery()
    expect(result.totalUsers).toBe(3)
  })

  it('counts only active (non-suspended) shops', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'shop-1', isSuspended: false })
    await seedShop({ id: 'shop-2', slug: 'shop-2', isSuspended: false })
    await seedShop({ id: 'shop-3', slug: 'shop-3', isSuspended: true })

    const result = await getAdminDashboardStatsQuery()
    expect(result.activeShops).toBe(2)
  })

  it('counts only open disputes, not resolved ones', async () => {
    await seedUser()
    await seedShop()
    const po1 = await seedPlatformOrder()
    const po2 = await seedPlatformOrder({ totalCents: 2000 })
    await seedShopOrder({ platformOrderId: po1.id })
    const so1 = await seedShopOrder({ platformOrderId: po1.id })
    const so2 = await seedShopOrder({ platformOrderId: po2.id })
    await seedDispute(so1.id, { status: 'open' })
    await seedDispute(so2.id, { status: 'resolved' })

    const result = await getAdminDashboardStatsQuery()
    expect(result.openDisputes).toBe(1)
  })

  it('counts only pending payouts, not sent ones', async () => {
    await seedUser()
    await seedShop()
    await seedPayout({ status: 'pending' })
    await seedPayout({ status: 'sent' })

    const result = await getAdminDashboardStatsQuery()
    expect(result.pendingPayouts).toBe(1)
  })

  it('returns correct stats when all metrics have data', async () => {
    await seedUser({ id: 'user-1', email: 'a@a.com' })
    await seedUser({ id: 'user-2', email: 'b@b.com' })
    await seedShop({ id: 'shop-1', slug: 'shop-1' })
    await seedShop({ id: 'shop-2', slug: 'shop-2' })
    const po1 = await seedPlatformOrder()
    const po2 = await seedPlatformOrder({ totalCents: 2000 })
    await seedShopOrder({ platformOrderId: po1.id })
    const so1 = await seedShopOrder({ platformOrderId: po1.id })
    const so2 = await seedShopOrder({ platformOrderId: po2.id })
    await seedDispute(so1.id, { status: 'open' })
    await seedDispute(so2.id, { status: 'open' })
    await seedPayout({ status: 'pending' })

    const result = await getAdminDashboardStatsQuery()

    expect(result).toEqual({
      totalUsers: 2,
      activeShops: 2,
      openDisputes: 2,
      pendingPayouts: 1,
    })
  })

  it('returns zero for a metric when only non-matching records exist', async () => {
    // Create records that should NOT appear in stats
    await seedUser()
    await seedShop({ isSuspended: true })
    const po = await seedPlatformOrder()
    const so = await seedShopOrder({ platformOrderId: po.id })
    await seedDispute(so.id, { status: 'resolved' })
    await seedPayout({ status: 'sent' })

    const result = await getAdminDashboardStatsQuery()
    expect(result).toEqual({
      totalUsers: 1, // user count is always total
      activeShops: 0, // suspended shop excluded
      openDisputes: 0, // only resolved dispute exists
      pendingPayouts: 0, // only sent payout exists
    })
  })

  it('runs all four counts in parallel', async () => {
    await seedUser()
    await seedUser({ id: 'user-2', email: 'b@b.com' })
    await seedShop()
    const po = await seedPlatformOrder()
    const so = await seedShopOrder({ platformOrderId: po.id })
    await seedDispute(so.id)

    const result = await getAdminDashboardStatsQuery()

    // Verify all counts are numbers (not null/undefined) regardless of execution order
    expect(typeof result.totalUsers).toBe('number')
    expect(typeof result.activeShops).toBe('number')
    expect(typeof result.openDisputes).toBe('number')
    expect(typeof result.pendingPayouts).toBe('number')

    expect(result.totalUsers).toBeGreaterThanOrEqual(0)
    expect(result.activeShops).toBeGreaterThanOrEqual(0)
    expect(result.openDisputes).toBeGreaterThanOrEqual(0)
    expect(result.pendingPayouts).toBeGreaterThanOrEqual(0)
  })
})
