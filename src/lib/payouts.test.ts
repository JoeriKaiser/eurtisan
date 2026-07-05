import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import type { platformOrder, shopOrder, user } from '#/db/schema'
import { payout, shop } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createPlatformOrder, createShop, createShopOrder, createUser } from '#/test/factories'
import { PLATFORM_FEE_PERCENT } from './payouts'
import { listCreatorPayoutsQuery } from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
  await clearTestTables()
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return createUser({
    id: 'user-1',
    name: 'Test Creator',
    email: 'creator@example.com',
    emailVerified: true,
    ...overrides,
  })
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return createShop('user-1', {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    ...overrides,
  })
}

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return createPlatformOrder('user-1', {
    totalCents: 10000,
    status: 'paid',
    ...overrides,
  })
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  return createShopOrder(
    overrides?.platformOrderId ?? '00000000-0000-0000-0000-000000000000',
    overrides?.shopId ?? 'shop-1',
    {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 5000,
      status: 'paid',
      ...overrides,
    },
  )
}

/* -------------------------------------------------------------------------- */
/*                                    Tests                                   */
/* -------------------------------------------------------------------------- */

describe('listCreatorPayoutsQuery', () => {
  it('returns empty list when shop has no eligible orders', async () => {
    await seedUser()
    await seedShop()

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it('returns empty list for nonexistent shop', async () => {
    const result = await listCreatorPayoutsQuery('nonexistent-shop')
    expect(result.payouts).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('only includes completed, delivered, and refunded orders', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    // Create orders in various statuses
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 1000,
      status: 'completed',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 2000,
      status: 'delivered',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 3000,
      status: 'refunded',
    })
    // These should NOT appear
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 4000,
      status: 'pending_payment',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'paid',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 6000,
      status: 'shipped',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.total).toBe(3)
    expect(result.payouts).toHaveLength(3)

    const statuses = result.payouts.map((p) => p.orderStatus).sort()
    expect(statuses).toEqual(['completed', 'delivered', 'refunded'])
  })

  it('derives payout amount as subtotal minus platform fee for completed orders', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 10000
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'completed',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(1)

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    const expectedAmount = subtotalCents - expectedFee

    expect(result.payouts[0].amountCents).toBe(expectedAmount)
    expect(result.payouts[0].isRefund).toBe(false)
  })

  it('derives payout amount for delivered orders', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 7500
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'delivered',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(1)

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    const expectedAmount = subtotalCents - expectedFee

    expect(result.payouts[0].amountCents).toBe(expectedAmount)
  })

  it('shows refunded orders as negative adjustment line items', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 5000
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'refunded',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(1)

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    const expectedAmount = -(subtotalCents - expectedFee)

    expect(result.payouts[0].amountCents).toBe(expectedAmount)
    expect(result.payouts[0].isRefund).toBe(true)
  })

  it('marks refunded orders with isRefund flag', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'completed',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 3000,
      status: 'refunded',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.total).toBe(2)

    const completed = result.payouts.find((p) => p.orderStatus === 'completed')
    const refunded = result.payouts.find((p) => p.orderStatus === 'refunded')

    expect(completed?.isRefund).toBe(false)
    expect(refunded?.isRefund).toBe(true)
  })

  it('returns correct payout statuses for delivered and completed orders', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'delivered',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 3000,
      status: 'completed',
    })

    const result = await listCreatorPayoutsQuery('shop-1')

    const delivered = result.payouts.find((p) => p.orderStatus === 'delivered')
    const completed = result.payouts.find((p) => p.orderStatus === 'completed')

    expect(delivered?.status).toBe('pending')
    expect(completed?.status).toBe('in_transit')
  })

  it('returns all statuses when status filter is "all"', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'delivered',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 3000,
      status: 'completed',
    })

    const allResult = await listCreatorPayoutsQuery('shop-1', { status: 'all' })
    expect(allResult.payouts).toHaveLength(2)

    const pendingResult = await listCreatorPayoutsQuery('shop-1', { status: 'pending' })
    expect(pendingResult.payouts).toHaveLength(1)
    expect(pendingResult.payouts[0]?.status).toBe('pending')
  })

  it('marks completed orders as sent when a sent payout record exists', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'completed',
    })

    // Create a sent payout record for this specific order
    await db.insert(payout).values({
      shopOrderId: order.id,
      shopId: 'shop-1',
      amountCents: 4500,
      status: 'sent',
      sentAt: new Date(),
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts[0].status).toBe('sent')
  })

  it('does not mark as sent when only pending payout records exist', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'completed',
    })

    // Create a pending payout record for this specific order
    await db.insert(payout).values({
      shopOrderId: order.id,
      shopId: 'shop-1',
      amountCents: 4500,
      status: 'pending',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts[0].status).toBe('pending')
  })

  it('tracks payout status per-order, not globally per-shop', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const order1 = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'completed',
    })

    const order2 = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 3000,
      status: 'completed',
    })

    // Only order1 has a sent payout
    await db.insert(payout).values({
      shopOrderId: order1.id,
      shopId: 'shop-1',
      amountCents: 4500,
      status: 'sent',
      sentAt: new Date(),
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.total).toBe(2)

    const line1 = result.payouts.find((p) => p.orderId === order1.id)
    const line2 = result.payouts.find((p) => p.orderId === order2.id)

    expect(line1?.status).toBe('sent')
    expect(line2?.status).toBe('in_transit')
  })

  it('supports pagination', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    // Create 5 orders
    for (let i = 0; i < 5; i++) {
      await seedShopOrder({
        platformOrderId: platformOrd.id,
        shopId: 'shop-1',
        subtotalCents: 1000 * (i + 1),
        status: 'completed',
      })
    }

    const page1 = await listCreatorPayoutsQuery('shop-1', { page: 1, pageSize: 2 })
    expect(page1.payouts).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.totalPages).toBe(3)
    expect(page1.page).toBe(1)

    const page2 = await listCreatorPayoutsQuery('shop-1', { page: 2, pageSize: 2 })
    expect(page2.payouts).toHaveLength(2)
    expect(page2.page).toBe(2)

    const page3 = await listCreatorPayoutsQuery('shop-1', { page: 3, pageSize: 2 })
    expect(page3.payouts).toHaveLength(1)
    expect(page3.page).toBe(3)

    // All pages should have distinct orders
    const allIds = [
      ...page1.payouts.map((p) => p.orderId),
      ...page2.payouts.map((p) => p.orderId),
      ...page3.payouts.map((p) => p.orderId),
    ]
    expect(new Set(allIds).size).toBe(5)
  })

  it('defaults to page 1 with pageSize 20', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 1000,
      status: 'completed',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('only returns orders for the specified shop', async () => {
    await seedUser()
    await seedShop()

    // Create a second shop
    await db.insert(shop).values({
      id: 'shop-2',
      name: 'Other Shop',
      slug: 'other-shop',
      ownerId: 'user-1',
    })

    const platformOrd = await seedPlatformOrder()

    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 1000,
      status: 'completed',
    })
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-2',
      subtotalCents: 2000,
      status: 'completed',
    })

    const shop1Result = await listCreatorPayoutsQuery('shop-1')
    expect(shop1Result.total).toBe(1)
    expect(shop1Result.payouts).toHaveLength(1)

    const shop2Result = await listCreatorPayoutsQuery('shop-2')
    expect(shop2Result.total).toBe(1)
    expect(shop2Result.payouts).toHaveLength(1)
  })

  it('returns orders sorted by creation date descending', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    // Create orders with a small delay to ensure different timestamps
    const order1 = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 1000,
      status: 'completed',
    })
    // Small delay for timestamp difference
    await new Promise((r) => setTimeout(r, 10))

    const order2 = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 2000,
      status: 'completed',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(2)

    // Most recent first
    expect(result.payouts[0].orderId).toBe(order2.id)
    expect(result.payouts[1].orderId).toBe(order1.id)
  })

  it('handles large page sizes up to 100', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    for (let i = 0; i < 3; i++) {
      await seedShopOrder({
        platformOrderId: platformOrd.id,
        shopId: 'shop-1',
        subtotalCents: 1000,
        status: 'completed',
      })
    }

    const result = await listCreatorPayoutsQuery('shop-1', { pageSize: 100 })
    expect(result.payouts).toHaveLength(3)
    expect(result.pageSize).toBe(100)
  })

  it('uses platform fee correctly for large amounts', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    // Use a subtotal that produces a non-integer fee after percentage
    const subtotalCents = 3333
    await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'completed',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    const expectedAmount = subtotalCents - expectedFee

    expect(result.payouts[0].amountCents).toBe(expectedAmount)
    // Verify fee rounding is correct
    expect(expectedFee).toBe(333) // 10% of 3333 = 333.3 → 333
    expect(expectedAmount).toBe(3000)
  })

  it('includes orderId, date, amountCents, status, orderStatus, and isRefund in each payout', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 10000,
      status: 'completed',
    })

    const result = await listCreatorPayoutsQuery('shop-1')
    const payout = result.payouts[0]

    expect(payout.orderId).toBe(order.id)
    expect(payout.date).toBeInstanceOf(Date)
    expect(typeof payout.amountCents).toBe('number')
    expect(['pending', 'in_transit', 'sent']).toContain(payout.status)
    expect(payout.orderStatus).toBe('completed')
    expect(payout.isRefund).toBe(false)
  })
})

describe('PLATFORM_FEE_PERCENT', () => {
  it('is defined as a positive number', () => {
    expect(PLATFORM_FEE_PERCENT).toBeGreaterThan(0)
    expect(PLATFORM_FEE_PERCENT).toBeLessThan(100)
  })
})
