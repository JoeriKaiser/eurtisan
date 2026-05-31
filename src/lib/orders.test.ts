import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  shippingLabel,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { mondialRelayProvider } from '#/integrations/shipping'

import {
  cancelOrderQuery,
  getBuyerOrderDetailQuery,
  getOrderOwnerId,
  listBuyerOrdersQuery,
} from './orders.server'

beforeEach(async () => {
  await db.delete(inventoryReservation)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser() {
  return db
    .insert(user)
    .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop() {
  return db
    .insert(shop)
    .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: 'user-1' })
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

describe('getBuyerOrderDetailQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getBuyerOrderDetailQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
    expect(result).toBeNull()
  })

  it('returns null when order belongs to another user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Other', email: 'other@example.com', emailVerified: true })
      .returning()
      .then((rows) => rows[0])

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: otherUser.id,
        shippingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const result = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(result).toBeNull()
  })

  it('returns order with shops and items', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
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
        totalCents: 2500,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    const result = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(order.id)
    expect(result?.totalCents).toBe(2500)
    expect(result?.cancelledAt).toBeNull()
    expect(result?.cancellationReason).toBeNull()
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shopId).toBe('shop-1')
    expect(result?.shops[0].shopName).toBe('Test Shop')
    expect(result?.shops[0].shippingMethod).toBe('standard')
    expect(result?.shops[0].deliveredAt).toBeNull()
    expect(result?.shops[0].items).toHaveLength(1)
    expect(result?.shops[0].items[0].productName).toBe('Vase')
    expect(result?.shops[0].items[0].quantity).toBe(2)
  })

  it('returns multiple shop groups', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop', ownerId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p1 = await seedProduct({ id: 'prod-1', shopId: 'shop-1' })
    const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', shopId: shop2.id })

    const [order] = await db
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
        totalCents: 4500,
      })
      .returning()

    const [so1] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
      })
      .returning()

    const [so2] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: shop2.id,
        shippingMethod: 'express',
        shippingCostCents: 1000,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(orderItem).values([
      {
        shopOrderId: so1.id,
        productId: p1.id,
        productName: p1.name,
        unitPriceCents: p1.priceCents,
        quantity: 1,
        totalCents: 1000,
      },
      {
        shopOrderId: so2.id,
        productId: p2.id,
        productName: p2.name,
        unitPriceCents: p2.priceCents,
        quantity: 1,
        totalCents: 2000,
      },
    ])

    const result = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(result?.shops).toHaveLength(2)
    const group1 = result?.shops.find((s) => s.shopId === 'shop-1')
    const group2 = result?.shops.find((s) => s.shopId === 'shop-2')
    expect(group1?.shippingMethod).toBe('standard')
    expect(group2?.shippingMethod).toBe('express')
  })

  it('populates shippingLabel and trackingStatus when a shipping label exists', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
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
        totalCents: 2500,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    await db.insert(shippingLabel).values({
      shopOrderId: so.id,
      carrier: 'mondial_relay',
      trackingNumber: 'MR12345678',
      labelUrl: 'https://mock.mondialrelay.example.com/labels/mrlbl_MR12345678.pdf',
    })

    const result = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shippingLabels).toHaveLength(1)
    expect(result?.shops[0].shippingLabels[0].carrier).toBe('mondial_relay')
    expect(result?.shops[0].shippingLabels[0].trackingNumber).toBe('MR12345678')
    expect(result?.shops[0].trackingStatus).not.toBeNull()
  })

  it('returns null shippingLabel and trackingStatus when no shipping label exists', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
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
        totalCents: 2500,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    const result = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shippingLabels).toHaveLength(0)
    expect(result?.shops[0].trackingStatus).toBeNull()
  })

  it('caches tracking status and uses cached value on subsequent calls', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()

    const [order] = await db
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
        totalCents: 2500,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(shippingLabel).values({
      shopOrderId: so.id,
      carrier: 'mondial_relay',
      trackingNumber: 'MR_CACHE_TEST_123',
    })

    const trackSpy = vi.spyOn(mondialRelayProvider, 'trackShipment')

    // First call: should query the provider
    const res1 = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(res1?.shops[0].trackingStatus).not.toBeNull()
    expect(trackSpy).toHaveBeenCalledTimes(1)

    // Second call: should use cache (zero API calls)
    const res2 = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(res2?.shops[0].trackingStatus).toBe(res1?.shops[0].trackingStatus)
    expect(trackSpy).toHaveBeenCalledTimes(1)

    trackSpy.mockRestore()
  })

  it('handles tracking provider timeout by returning null and not blocking indefinitely', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
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
        totalCents: 2500,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(shippingLabel).values({
      shopOrderId: so.id,
      carrier: 'mondial_relay',
      trackingNumber: 'MR_TIMEOUT_TEST_123',
    })

    // Mock tracking status to delay longer than the 1s timeout
    const trackSpy = vi
      .spyOn(mondialRelayProvider, 'trackShipment')
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        return {
          trackingNumber: 'MR_TIMEOUT_TEST_123',
          carrier: 'mondial_relay',
          status: 'in_transit',
          events: [],
        }
      })

    const start = Date.now()
    const result = await getBuyerOrderDetailQuery(order.id, 'user-1')
    const elapsed = Date.now() - start

    // Should resolve around 1 second (not block for 1.5 seconds)
    expect(elapsed).toBeLessThan(1400)
    expect(result?.shops[0].trackingStatus).toBeNull()

    trackSpy.mockRestore()
  })

  it('falls back to expired cached value if the tracking provider fails or times out', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
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
        totalCents: 2500,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
      })
      .returning()

    await db.insert(shippingLabel).values({
      shopOrderId: so.id,
      carrier: 'mondial_relay',
      trackingNumber: 'MR_FALLBACK_TEST_123',
    })

    let mockTime = Date.now()
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockTime)
    const trackSpy = vi.spyOn(mondialRelayProvider, 'trackShipment')

    // First call: should query the provider and cache it
    const res1 = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(res1?.shops[0].trackingStatus).not.toBeNull()
    const firstStatus = res1?.shops[0].trackingStatus

    // Advance time by 20 minutes (TTL is 15 minutes, so it expires)
    mockTime += 20 * 60 * 1000

    // Mock trackShipment to fail/timeout
    trackSpy.mockRejectedValue(new Error('API failure'))

    // Second call: should attempt to call trackShipment, fail, but fall back to the expired cached value
    const res2 = await getBuyerOrderDetailQuery(order.id, 'user-1')
    expect(res2?.shops[0].trackingStatus).toBe(firstStatus)

    trackSpy.mockRestore()
    dateSpy.mockRestore()
  })
})

describe('getOrderOwnerId', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getOrderOwnerId('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toBeNull()
  })

  it('returns owner id for existing order', async () => {
    await seedUser()
    const [order] = await db
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
      })
      .returning()

    const result = await getOrderOwnerId(order.id)
    expect(result).toBe('user-1')
  })
})

describe('listBuyerOrdersQuery', () => {
  it('returns empty list when user has no orders', async () => {
    const result = await listBuyerOrdersQuery('user-1', 10, 0)
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns paginated orders ordered by created_at desc', async () => {
    await seedUser()
    await seedShop()

    const order1 = await db
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
        status: 'paid',
      })
      .returning()
      .then((rows) => rows[0])

    const order2 = await db
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
        totalCents: 2000,
        status: 'shipped',
      })
      .returning()
      .then((rows) => rows[0])

    await db.insert(shopOrder).values({
      platformOrderId: order1.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'paid',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order2.id,
      shopId: 'shop-1',
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 2000,
      status: 'shipped',
    })

    const result = await listBuyerOrdersQuery('user-1', 10, 0)
    expect(result.total).toBe(2)
    expect(result.orders).toHaveLength(2)
    // Most recent first
    expect(result.orders[0].id).toBe(order2.id)
    expect(result.orders[0].status).toBe('shipped')
    expect(result.orders[0].totalCents).toBe(2000)
    expect(result.orders[0].shopCount).toBe(1)
    expect(result.orders[0].shopSummary).toHaveLength(1)
    expect(result.orders[0].shopSummary[0].shopId).toBe('shop-1')
    expect(result.orders[0].shopSummary[0].status).toBe('shipped')
    expect(result.orders[1].id).toBe(order1.id)
    expect(result.orders[1].status).toBe('paid')
    expect(result.orders[1].shopSummary).toHaveLength(1)
    expect(result.orders[1].shopSummary[0].status).toBe('paid')
  })

  it('respects limit and offset', async () => {
    await seedUser()
    await seedShop()

    for (let i = 0; i < 3; i++) {
      await db.insert(platformOrder).values({
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
        totalCents: (i + 1) * 1000,
      })
    }

    const page1 = await listBuyerOrdersQuery('user-1', 2, 0)
    expect(page1.orders).toHaveLength(2)
    expect(page1.total).toBe(3)

    const page2 = await listBuyerOrdersQuery('user-1', 2, 2)
    expect(page2.orders).toHaveLength(1)
    expect(page2.total).toBe(3)
  })

  it('does not return other users orders', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Other', email: 'other@example.com', emailVerified: true })
      .returning()
      .then((rows) => rows[0])

    await db.insert(platformOrder).values({
      userId: otherUser.id,
      shippingAddress: {
        name: 'Other',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      },
      billingAddress: {
        name: 'Other',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      },
      totalCents: 1000,
    })

    const result = await listBuyerOrdersQuery('user-1', 10, 0)
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns per-shop status summary for multi-shop orders', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop', ownerId: 'user-1' })
      .returning()
      .then((rows) => rows[0])

    const [order] = await db
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
        totalCents: 3000,
        status: 'paid',
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'paid',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: shop2.id,
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 1500,
      status: 'processing',
    })

    const result = await listBuyerOrdersQuery('user-1', 10, 0)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].shopCount).toBe(2)
    expect(result.orders[0].shopSummary).toHaveLength(2)
    const s1 = result.orders[0].shopSummary.find((s) => s.shopId === 'shop-1')
    const s2 = result.orders[0].shopSummary.find((s) => s.shopId === 'shop-2')
    expect(s1?.shopName).toBe('Test Shop')
    expect(s1?.status).toBe('paid')
    expect(s2?.shopName).toBe('Second Shop')
    expect(s2?.status).toBe('processing')
  })
})

describe('cancelOrderQuery', () => {
  it('throws 404 for nonexistent order', async () => {
    try {
      await cancelOrderQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 404 when order belongs to another user', async () => {
    await seedUser()
    const otherUser = await db
      .insert(user)
      .values({ id: 'user-2', name: 'Other', email: 'other@example.com', emailVerified: true })
      .returning()
      .then((rows) => rows[0])

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: otherUser.id,
        shippingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'pending_payment',
      })
      .returning()

    try {
      await cancelOrderQuery(order.id, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 409 when order is not pending_payment', async () => {
    await seedUser()
    const [order] = await db
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
        status: 'paid',
      })
      .returning()

    try {
      await cancelOrderQuery(order.id, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('cancels platform and shop orders and releases stock', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
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
        totalCents: 2500,
        status: 'pending_payment',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
        status: 'pending_payment',
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    // Create a reservation for this order
    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cancelOrderQuery(order.id, 'user-1')
    expect(result.success).toBe(true)

    const [updatedOrder] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(updatedOrder.status).toBe('cancelled')
    expect(updatedOrder.cancelledAt).not.toBeNull()

    const [updatedShopOrder] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedShopOrder.status).toBe('cancelled')

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))
    expect(reservations).toHaveLength(0)
  })
})
