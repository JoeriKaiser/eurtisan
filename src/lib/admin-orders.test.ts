import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, shop, shopOrder, user } from '#/db/schema'

import { getPlatformOrderDetailQuery, listAllPlatformOrdersQuery } from './admin-orders.server'

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
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
      name: 'Test Buyer',
      email: 'buyer@example.com',
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

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return db
    .insert(product)
    .values({
      id: 'prod-1',
      name: 'Test Product',
      slug: 'test-product',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'shop-1',
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
        name: 'Test Buyer',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'Germany',
      },
      billingAddress: {
        name: 'Test Buyer',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'Germany',
      },
      totalCents: 2500,
      status: 'paid',
      molliePaymentId: null,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(
  platformOrderId: string,
  overrides?: Partial<typeof shopOrder.$inferInsert>,
) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
      status: 'paid',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedOrderItem(
  shopOrderId: string,
  overrides?: Partial<typeof orderItem.$inferInsert>,
) {
  return db
    .insert(orderItem)
    .values({
      shopOrderId,
      productId: 'prod-1',
      productName: 'Test Product',
      unitPriceCents: 1000,
      quantity: 2,
      totalCents: 2000,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                       listAllPlatformOrdersQuery                            */
/* -------------------------------------------------------------------------- */

describe('listAllPlatformOrdersQuery', () => {
  it('returns empty result when no orders exist', async () => {
    const result = await listAllPlatformOrdersQuery(undefined, 1, 20)
    expect(result.orders).toEqual([])
    expect(result.total).toBe(0)
  })

  it('returns all orders sorted newest first', async () => {
    await seedUser()
    await seedPlatformOrder({ createdAt: new Date('2026-01-01T00:00:00Z') })
    await seedPlatformOrder({ createdAt: new Date('2026-03-01T00:00:00Z') })

    const result = await listAllPlatformOrdersQuery(undefined, 1, 20)
    expect(result.orders).toHaveLength(2)
    // Newest first
    expect(new Date(result.orders[0].createdAt).getTime()).toBeGreaterThan(
      new Date(result.orders[1].createdAt).getTime(),
    )
    expect(result.total).toBe(2)
  })

  it('searches by order ID', async () => {
    await seedUser()
    const po = await seedPlatformOrder()

    // Search with a partial UUID from the actual order
    const partialId = po.id.slice(0, 8)
    const result = await listAllPlatformOrdersQuery(partialId, 1, 20)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].id).toBe(po.id)
  })

  it('searches by buyer name', async () => {
    await seedUser({ id: 'user-a', name: 'Alice Johnson' })
    await seedPlatformOrder({ userId: 'user-a' })

    const result = await listAllPlatformOrdersQuery('Alice', 1, 20)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].buyerName).toBe('Alice Johnson')
  })

  it('searches by buyer email', async () => {
    await seedUser({ id: 'user-a', email: 'alice@example.com' })
    await seedPlatformOrder({ userId: 'user-a' })

    const result = await listAllPlatformOrdersQuery('alice@example.com', 1, 20)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].buyerEmail).toBe('alice@example.com')
  })

  it('returns no results for non-matching search', async () => {
    await seedUser()
    await seedPlatformOrder()

    const result = await listAllPlatformOrdersQuery('nosuchvalue', 1, 20)
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('case-insensitive search', async () => {
    await seedUser({ id: 'user-b', name: 'Bob Smith' })
    await seedPlatformOrder({ userId: 'user-b' })

    const result = await listAllPlatformOrdersQuery('bob', 1, 20)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].buyerName).toBe('Bob Smith')
  })

  it('supports pagination', async () => {
    await seedUser()
    for (let i = 0; i < 5; i++) {
      await seedPlatformOrder()
    }

    const page1 = await listAllPlatformOrdersQuery(undefined, 1, 2)
    expect(page1.orders).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(2)

    const page2 = await listAllPlatformOrdersQuery(undefined, 2, 2)
    expect(page2.orders).toHaveLength(2)
    expect(page2.page).toBe(2)

    const page3 = await listAllPlatformOrdersQuery(undefined, 3, 2)
    expect(page3.orders).toHaveLength(1)
    expect(page3.page).toBe(3)
  })

  it('defaults to page 1 with pageSize 20', async () => {
    await seedUser()
    await seedPlatformOrder()

    const result = await listAllPlatformOrdersQuery(undefined, 1, 20)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('includes buyer info in results', async () => {
    await seedUser({ id: 'user-c', name: 'Charlie', email: 'charlie@example.com' })
    await seedPlatformOrder({ userId: 'user-c' })

    const result = await listAllPlatformOrdersQuery(undefined, 1, 20)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].buyerName).toBe('Charlie')
    expect(result.orders[0].buyerEmail).toBe('charlie@example.com')
  })

  it('counts shops per order correctly', async () => {
    await seedUser()
    await seedShop({ id: 'shop-a', name: 'Shop A', slug: 'shop-a', ownerId: 'user-1' })
    await seedShop({ id: 'shop-b', name: 'Shop B', slug: 'shop-b', ownerId: 'user-1' })
    const po = await seedPlatformOrder()
    await seedShopOrder(po.id, { shopId: 'shop-a' })
    await seedShopOrder(po.id, { shopId: 'shop-b' })

    const result = await listAllPlatformOrdersQuery(undefined, 1, 20)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].shopCount).toBe(2)
  })
})

/* -------------------------------------------------------------------------- */
/*                     getPlatformOrderDetailQuery                             */
/* -------------------------------------------------------------------------- */

describe('getPlatformOrderDetailQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getPlatformOrderDetailQuery('00000000-0000-0000-0000-000000000099')
    expect(result).toBeNull()
  })

  it('returns full order tree', async () => {
    await seedUser({ id: 'user-x', name: 'Alice', email: 'alice@test.com' })
    await seedShop({
      id: 'shop-x',
      name: 'Alice Shop',
      slug: 'alice-shop',
      ownerId: 'user-x',
    })
    await seedProduct({ id: 'prod-x', name: 'Handmade Vase', shopId: 'shop-x' })
    const po = await seedPlatformOrder({
      userId: 'user-x',
      totalCents: 4500,
      status: 'paid',
      molliePaymentId: 'tr_abc123',
    })
    const so = await seedShopOrder(po.id, {
      shopId: 'shop-x',
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 3500,
      status: 'processing',
      trackingNumber: 'TRACK999',
      trackingUrl: 'https://track.example.com/999',
    })
    await seedOrderItem(so.id, {
      productId: 'prod-x',
      productName: 'Handmade Vase',
      unitPriceCents: 3500,
      quantity: 1,
      totalCents: 3500,
    })

    const result = await getPlatformOrderDetailQuery(po.id)
    expect(result).not.toBeNull()
    if (!result) return

    // Basic order info
    expect(result.id).toBe(po.id)
    expect(result.buyerName).toBe('Alice')
    expect(result.buyerEmail).toBe('alice@test.com')
    expect(result.totalCents).toBe(4500)
    expect(result.status).toBe('paid')
    expect(result.molliePaymentId).toBe('tr_abc123')

    // Shipping address
    expect(result.shippingAddress.name).toBe('Test Buyer')
    expect(result.shippingAddress.city).toBe('Berlin')

    // Shop orders
    expect(result.shops).toHaveLength(1)
    const shopGroup = result.shops[0]
    expect(shopGroup.shopName).toBe('Alice Shop')
    expect(shopGroup.shippingMethod).toBe('express')
    expect(shopGroup.shippingCostCents).toBe(1000)
    expect(shopGroup.subtotalCents).toBe(3500)
    expect(shopGroup.status).toBe('processing')
    expect(shopGroup.trackingNumber).toBe('TRACK999')

    // Items
    expect(shopGroup.items).toHaveLength(1)
    expect(shopGroup.items[0].productName).toBe('Handmade Vase')
    expect(shopGroup.items[0].unitPriceCents).toBe(3500)
    expect(shopGroup.items[0].quantity).toBe(1)
    expect(shopGroup.items[0].totalCents).toBe(3500)
  })

  it('returns cancellation info for cancelled orders', async () => {
    await seedUser()
    const po = await seedPlatformOrder({
      status: 'cancelled',
      cancelledAt: new Date('2026-05-10T12:00:00Z'),
      cancellationReason: 'Payment failed',
    })

    const result = await getPlatformOrderDetailQuery(po.id)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.status).toBe('cancelled')
    expect(result.cancelledAt).toEqual(new Date('2026-05-10T12:00:00Z'))
    expect(result.cancellationReason).toBe('Payment failed')
  })

  it('returns multiple shop orders', async () => {
    await seedUser()
    await seedShop({ id: 'shop-a', name: 'Shop A', slug: 'shop-a', ownerId: 'user-1' })
    await seedShop({ id: 'shop-b', name: 'Shop B', slug: 'shop-b', ownerId: 'user-1' })
    await seedProduct({ id: 'prod-a', name: 'Item A', shopId: 'shop-a' })
    await seedProduct({ id: 'prod-b', name: 'Item B', shopId: 'shop-b' })
    const po = await seedPlatformOrder()
    const soA = await seedShopOrder(po.id, { shopId: 'shop-a', subtotalCents: 1000 })
    const soB = await seedShopOrder(po.id, { shopId: 'shop-b', subtotalCents: 1500 })
    await seedOrderItem(soA.id, { productId: 'prod-a', productName: 'Item A' })
    await seedOrderItem(soB.id, { productId: 'prod-b', productName: 'Item B' })

    const result = await getPlatformOrderDetailQuery(po.id)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.shops).toHaveLength(2)
    const shopNames = result.shops.map((s) => s.shopName).sort()
    expect(shopNames).toEqual(['Shop A', 'Shop B'])
  })

  it('handles order with no shop orders', async () => {
    await seedUser()
    const po = await seedPlatformOrder()

    const result = await getPlatformOrderDetailQuery(po.id)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.shops).toHaveLength(0)
  })

  it('handles order with no payment ID', async () => {
    await seedUser()
    const po = await seedPlatformOrder({ molliePaymentId: null })

    const result = await getPlatformOrderDetailQuery(po.id)
    expect(result).not.toBeNull()
    if (!result) return

    expect(result.molliePaymentId).toBeNull()
  })

  it('returns billing address', async () => {
    await seedUser()
    const po = await seedPlatformOrder({
      billingAddress: {
        name: 'Billing Person',
        street: '456 Billing Rd',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
      },
    })

    const result = await getPlatformOrderDetailQuery(po.id)
    expect(result).not.toBeNull()
    if (!result) return

    const ba = result.billingAddress
    expect(ba.name).toBe('Billing Person')
    expect(ba.city).toBe('Paris')
  })
})
