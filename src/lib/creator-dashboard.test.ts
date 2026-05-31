import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, review, shop, shopOrder, user } from '#/db/schema'
import { requireRole } from './authz'
import {
  getCreatorDashboardStatsQuery,
  getCreatorRecentActivityQuery,
} from './creator-dashboard.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(review)
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
      role: 'creator',
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

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return db
    .insert(product)
    .values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'shop-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedBuyer(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'buyer-1',
      name: 'Test Buyer',
      email: 'buyer@example.com',
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPlatformOrder(
  buyerId: string,
  overrides?: Partial<typeof platformOrder.$inferInsert>,
) {
  return db
    .insert(platformOrder)
    .values({
      userId: buyerId,
      shippingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      },
      billingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '00000',
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
      platformOrderId: 'placeholder',
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                          getCreatorDashboardStatsQuery                     */
/* -------------------------------------------------------------------------- */

describe('getCreatorDashboardStatsQuery', () => {
  it('returns zeroed stats for a creator with no shops', async () => {
    await seedUser()

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result).toEqual({
      revenueThisMonthCents: 0,
      pendingOrdersCount: 0,
      lowStockProductCount: 0,
      totalShopCount: 0,
    })
  })

  it('returns correct stats for a single shop', async () => {
    await seedUser()
    await seedShop()
    await seedProduct({ stockCount: 3 })
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)
    await seedShopOrder({ platformOrderId: po.id, status: 'paid', subtotalCents: 5000 })

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.totalShopCount).toBe(1)
    expect(result.lowStockProductCount).toBe(1)
    expect(result.pendingOrdersCount).toBe(1)
    expect(result.revenueThisMonthCents).toBe(5000)
  })

  it('aggregates stats across multiple shops', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'shop-1' })
    await seedShop({ id: 'shop-2', slug: 'shop-2', name: 'Second Shop' })

    await seedProduct({ id: 'prod-1', slug: 'prod-1', stockCount: 3, shopId: 'shop-1' })
    await seedProduct({ id: 'prod-2', slug: 'prod-2', stockCount: 10, shopId: 'shop-1' })
    await seedProduct({ id: 'prod-3', slug: 'prod-3', stockCount: 2, shopId: 'shop-2' })

    const buyer = await seedBuyer()
    const po1 = await seedPlatformOrder(buyer.id)
    const po2 = await seedPlatformOrder(buyer.id, { totalCents: 2000 })

    await seedShopOrder({
      platformOrderId: po1.id,
      shopId: 'shop-1',
      status: 'paid',
      subtotalCents: 3000,
    })
    await seedShopOrder({
      platformOrderId: po2.id,
      shopId: 'shop-2',
      status: 'processing',
      subtotalCents: 2000,
    })
    await seedShopOrder({
      platformOrderId: po1.id,
      shopId: 'shop-1',
      status: 'pending_payment',
      subtotalCents: 1500,
    })

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.totalShopCount).toBe(2)
    expect(result.lowStockProductCount).toBe(2)
    expect(result.pendingOrdersCount).toBe(3)
    expect(result.revenueThisMonthCents).toBe(5000)
  })

  it('excludes cancelled and refunded orders from revenue', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)

    await seedShopOrder({ platformOrderId: po.id, status: 'cancelled', subtotalCents: 1000 })
    await seedShopOrder({ platformOrderId: po.id, status: 'refunded', subtotalCents: 2000 })
    await seedShopOrder({ platformOrderId: po.id, status: 'paid', subtotalCents: 3000 })

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.revenueThisMonthCents).toBe(3000)
  })

  it('excludes pending_payment from revenue', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)

    await seedShopOrder({ platformOrderId: po.id, status: 'pending_payment', subtotalCents: 5000 })

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.revenueThisMonthCents).toBe(0)
  })

  it('counts only pending_payment, paid, and processing as pending', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)

    await seedShopOrder({ platformOrderId: po.id, status: 'pending_payment', subtotalCents: 100 })
    await seedShopOrder({ platformOrderId: po.id, status: 'paid', subtotalCents: 100 })
    await seedShopOrder({ platformOrderId: po.id, status: 'processing', subtotalCents: 100 })
    await seedShopOrder({ platformOrderId: po.id, status: 'shipped', subtotalCents: 100 })
    await seedShopOrder({ platformOrderId: po.id, status: 'completed', subtotalCents: 100 })
    await seedShopOrder({ platformOrderId: po.id, status: 'cancelled', subtotalCents: 100 })

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.pendingOrdersCount).toBe(3)
  })

  it('only counts revenue from the current month', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()
    const buyer = await seedBuyer()

    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    const po1 = await seedPlatformOrder(buyer.id)
    const po2 = await seedPlatformOrder(buyer.id)

    await seedShopOrder({ platformOrderId: po1.id, status: 'paid', subtotalCents: 5000 })

    await db
      .insert(shopOrder)
      .values({
        platformOrderId: po2.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 3000,
        status: 'paid',
        createdAt: lastMonth,
      })
      .returning()

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.revenueThisMonthCents).toBe(5000)
  })

  it('does not count products from other creators', async () => {
    await seedUser()
    await seedShop()
    await seedProduct({ stockCount: 3 })

    await db.insert(user).values({
      id: 'other-user',
      name: 'Other',
      email: 'other@example.com',
      emailVerified: true,
      role: 'creator',
    })

    await db.insert(shop).values({
      id: 'other-shop',
      name: 'Other Shop',
      slug: 'other-shop',
      ownerId: 'other-user',
    })

    await db.insert(product).values({
      id: 'other-prod',
      name: 'Other Vase',
      slug: 'other-vase',
      priceCents: 1000,
      stockCount: 2,
      shopId: 'other-shop',
    })

    const result = await getCreatorDashboardStatsQuery('user-1')
    expect(result.lowStockProductCount).toBe(1)
    expect(result.totalShopCount).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/*                         getCreatorRecentActivityQuery                      */
/* -------------------------------------------------------------------------- */

describe('getCreatorRecentActivityQuery', () => {
  it('returns empty array for a creator with no shops', async () => {
    await seedUser()

    const result = await getCreatorRecentActivityQuery('user-1', 10)
    expect(result).toEqual([])
  })

  it('returns orders and reviews merged chronologically', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)
    const so = await seedShopOrder({ platformOrderId: po.id, status: 'paid' })

    await db.insert(review).values({
      shopOrderId: so.id,
      productId: p.id,
      buyerUserId: buyer.id,
      rating: 5,
      comment: 'Great product!',
    })

    const result = await getCreatorRecentActivityQuery('user-1', 10)
    expect(result).toHaveLength(2)

    const orderActivity = result.find((a) => a.kind === 'order')
    expect(orderActivity).toBeDefined()
    expect(orderActivity?.kind).toBe('order')
    if (orderActivity?.kind === 'order') {
      expect(orderActivity.buyerName).toBe('Test Buyer')
      expect(orderActivity.totalCents).toBe(1000)
    }

    const reviewActivity = result.find((a) => a.kind === 'review')
    expect(reviewActivity).toBeDefined()
    expect(reviewActivity?.kind).toBe('review')
    if (reviewActivity?.kind === 'review') {
      expect(reviewActivity.rating).toBe(5)
      expect(reviewActivity.comment).toBe('Great product!')
      expect(reviewActivity.productName).toBe('Vase')
    }
  })

  it('sorts activities by createdAt descending', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)
    const so = await seedShopOrder({ platformOrderId: po.id, status: 'paid' })

    const yesterday = new Date(Date.now() - 86400000)
    const today = new Date()

    await db.insert(shopOrder).values({
      platformOrderId: po.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 500,
      status: 'paid',
      createdAt: today,
    })

    await db.insert(review).values({
      shopOrderId: so.id,
      productId: p.id,
      buyerUserId: buyer.id,
      rating: 4,
      comment: null,
      createdAt: yesterday,
    })

    const result = await getCreatorRecentActivityQuery('user-1', 10)
    expect(result).toHaveLength(3)
    expect(result[0].kind).toBe('order')
    expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(result[1].createdAt.getTime())
  })

  it('respects the limit', async () => {
    await seedUser()
    await seedShop()
    const buyer = await seedBuyer()

    for (let i = 0; i < 5; i++) {
      const po = await seedPlatformOrder(buyer.id)
      await seedShopOrder({ platformOrderId: po.id, status: 'paid', subtotalCents: 100 })
    }

    const result = await getCreatorRecentActivityQuery('user-1', 3)
    expect(result).toHaveLength(3)
  })

  it('aggregates activity across multiple shops', async () => {
    await seedUser()
    await seedShop({ id: 'shop-1', slug: 'shop-1' })
    await seedShop({ id: 'shop-2', slug: 'shop-2', name: 'Second Shop' })

    const p1 = await seedProduct({ id: 'prod-1', slug: 'prod-1', shopId: 'shop-1' })
    const p2 = await seedProduct({ id: 'prod-2', slug: 'prod-2', shopId: 'shop-2' })

    const buyer = await seedBuyer()
    const po1 = await seedPlatformOrder(buyer.id)
    const po2 = await seedPlatformOrder(buyer.id)

    const so1 = await seedShopOrder({ platformOrderId: po1.id, shopId: 'shop-1', status: 'paid' })
    const so2 = await seedShopOrder({ platformOrderId: po2.id, shopId: 'shop-2', status: 'paid' })

    await db.insert(review).values({
      shopOrderId: so1.id,
      productId: p1.id,
      buyerUserId: buyer.id,
      rating: 5,
    })

    await db.insert(review).values({
      shopOrderId: so2.id,
      productId: p2.id,
      buyerUserId: buyer.id,
      rating: 4,
    })

    const result = await getCreatorRecentActivityQuery('user-1', 10)
    expect(result).toHaveLength(4)

    const shop1Activities = result.filter((a) => a.shopId === 'shop-1')
    const shop2Activities = result.filter((a) => a.shopId === 'shop-2')
    expect(shop1Activities).toHaveLength(2)
    expect(shop2Activities).toHaveLength(2)
  })

  it('does not return activity from other creators', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()
    const buyer = await seedBuyer()
    const po = await seedPlatformOrder(buyer.id)
    await seedShopOrder({ platformOrderId: po.id, status: 'paid' })

    await db.insert(user).values({
      id: 'other-user',
      name: 'Other',
      email: 'other@example.com',
      emailVerified: true,
      role: 'creator',
    })

    await db.insert(shop).values({
      id: 'other-shop',
      name: 'Other Shop',
      slug: 'other-shop',
      ownerId: 'other-user',
    })

    await db.insert(product).values({
      id: 'other-prod',
      name: 'Other Vase',
      slug: 'other-vase',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'other-shop',
    })

    const otherPo = await seedPlatformOrder(buyer.id)
    await db.insert(shopOrder).values({
      platformOrderId: otherPo.id,
      shopId: 'other-shop',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 500,
      status: 'paid',
    })

    const result = await getCreatorRecentActivityQuery('user-1', 10)
    expect(result).toHaveLength(1)
    expect(result[0].shopId).toBe('shop-1')
  })
})

/* -------------------------------------------------------------------------- */
/*                               Role Guard Tests                             */
/* -------------------------------------------------------------------------- */

describe('role guard', () => {
  it('requireRole(creator) throws 403 for customer', () => {
    const ctx = {
      user: {
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
        image: null,
        role: 'customer' as const,
        bannedAt: null,
        banReason: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'session-1',
        token: 'tok-1',
        expiresAt: new Date(Date.now() + 3600_000),
        userId: 'user-1',
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }

    expect(() => requireRole('creator')(ctx)).toThrow(
      expect.objectContaining({
        status: 403,
        body: { error: 'Forbidden', message: "Insufficient role. Required: 'creator' or higher." },
      }),
    )
  })

  it('requireRole(creator) allows creator', () => {
    const ctx = {
      user: {
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
        image: null,
        role: 'creator' as const,
        bannedAt: null,
        banReason: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'session-1',
        token: 'tok-1',
        expiresAt: new Date(Date.now() + 3600_000),
        userId: 'user-1',
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }

    expect(requireRole('creator')(ctx)).toBe(ctx)
  })

  it('requireRole(creator) allows admin', () => {
    const ctx = {
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        image: null,
        role: 'admin' as const,
        bannedAt: null,
        banReason: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'session-1',
        token: 'tok-1',
        expiresAt: new Date(Date.now() + 3600_000),
        userId: 'admin-1',
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }

    expect(requireRole('creator')(ctx)).toBe(ctx)
  })
})
