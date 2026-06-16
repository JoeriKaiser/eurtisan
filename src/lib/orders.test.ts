import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { inventoryReservation, platformOrder, shopOrder } from '#/db/schema'
import { mockShippingProvider, resetMockShippingCounter } from '#/integrations/shipping'
import { clearTestTables } from '#/test/cleanup'
import {
  createInventoryReservation,
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createShippingLabel,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'

import {
  cancelOrderQuery,
  getBuyerOrderDetailQuery,
  getOrderOwnerId,
  listBuyerOrdersQuery,
} from './orders.server'

beforeEach(async () => {
  resetMockShippingCounter()
  await clearTestTables()
})

describe('getBuyerOrderDetailQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getBuyerOrderDetailQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
    expect(result).toBeNull()
  })

  it('returns null when order belongs to another user', async () => {
    const user = await createUser()
    await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const otherUser = await createUser({ name: 'Other', email: 'other@example.com' })

    const order = await createPlatformOrder(otherUser)

    const result = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(result).toBeNull()
  })

  it('returns order with shops and items', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(user, { totalCents: 2500 })
    const shopOrder = await createShopOrder(order, shop, {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
    })
    await createOrderItem(shopOrder, product, { quantity: 2 })

    const result = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(order.id)
    expect(result?.totalCents).toBe(2500)
    expect(result?.cancelledAt).toBeNull()
    expect(result?.cancellationReason).toBeNull()
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shopId).toBe(shop.id)
    expect(result?.shops[0].shopName).toBe('Test Shop')
    expect(result?.shops[0].shippingMethod).toBe('standard')
    expect(result?.shops[0].deliveredAt).toBeNull()
    expect(result?.shops[0].items).toHaveLength(1)
    expect(result?.shops[0].items[0].productName).toBe('Vase')
    expect(result?.shops[0].items[0].quantity).toBe(2)
  })

  it('returns multiple shop groups', async () => {
    const user = await createUser()
    const shop1 = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const shop2 = await createShop(user, { name: 'Second Shop', slug: 'second-shop' })
    const product1 = await createProduct(shop1, { name: 'Vase', slug: 'vase' })
    const product2 = await createProduct(shop2, { name: 'Bowl', slug: 'bowl' })

    const order = await createPlatformOrder(user, { totalCents: 4500 })

    const shopOrder1 = await createShopOrder(order, shop1, {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
    })
    const shopOrder2 = await createShopOrder(order, shop2, {
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 2000,
    })

    await createOrderItem(shopOrder1, product1, { quantity: 1, totalCents: 1000 })
    await createOrderItem(shopOrder2, product2, { quantity: 1, totalCents: 2000 })

    const result = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(result?.shops).toHaveLength(2)
    const group1 = result?.shops.find((s) => s.shopId === shop1.id)
    const group2 = result?.shops.find((s) => s.shopId === shop2.id)
    expect(group1?.shippingMethod).toBe('standard')
    expect(group2?.shippingMethod).toBe('express')
  })

  it('populates shippingLabel and trackingStatus when a shipping label exists', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(user, { totalCents: 2500 })
    const shopOrder = await createShopOrder(order, shop, {
      shippingCostCents: 500,
      subtotalCents: 2000,
    })
    await createOrderItem(shopOrder, product, { quantity: 2 })

    await createShippingLabel(shopOrder, {
      carrier: 'sendcloud',
      trackingNumber: 'SC12345678',
      labelUrl: 'https://mock.sendcloud.example.com/labels/sclbl_SC12345678.pdf',
    })

    const result = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(result).not.toBeNull()
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shippingLabels).toHaveLength(1)
    expect(result?.shops[0].shippingLabels[0].carrier).toBe('sendcloud')
    expect(result?.shops[0].shippingLabels[0].trackingNumber).toBe('SC12345678')
    expect(result?.shops[0].trackingStatus).not.toBeNull()
  })

  it('returns null shippingLabel and trackingStatus when no shipping label exists', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(user, { totalCents: 2500 })
    const shopOrder = await createShopOrder(order, shop, {
      shippingCostCents: 500,
      subtotalCents: 2000,
    })
    await createOrderItem(shopOrder, product, { quantity: 2 })

    const result = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(result).not.toBeNull()
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shippingLabels).toHaveLength(0)
    expect(result?.shops[0].trackingStatus).toBeNull()
  })

  it('caches tracking status and uses cached value on subsequent calls', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(user, { totalCents: 2500 })
    const shopOrder = await createShopOrder(order, shop, {
      shippingCostCents: 500,
      subtotalCents: 2000,
    })
    await createOrderItem(shopOrder, product, { quantity: 2 })

    await createShippingLabel(shopOrder, {
      carrier: 'sendcloud',
      trackingNumber: 'SC_CACHE_TEST_123',
    })

    const trackSpy = vi.spyOn(mockShippingProvider, 'trackShipment')

    // First call: should query the provider
    const res1 = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(res1?.shops[0].trackingStatus).not.toBeNull()
    expect(trackSpy).toHaveBeenCalledTimes(1)

    // Second call: should use cache (zero API calls)
    const res2 = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(res2?.shops[0].trackingStatus).toBe(res1?.shops[0].trackingStatus)
    expect(trackSpy).toHaveBeenCalledTimes(1)

    trackSpy.mockRestore()
  })

  it('handles tracking provider timeout by returning null and not blocking indefinitely', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })

    const order = await createPlatformOrder(user, { totalCents: 2500 })
    const shopOrder = await createShopOrder(order, shop, {
      shippingCostCents: 500,
      subtotalCents: 2000,
    })

    await createShippingLabel(shopOrder, {
      carrier: 'sendcloud',
      trackingNumber: 'SC_TIMEOUT_TEST_123',
    })

    // Mock tracking status to delay longer than the 1s timeout
    const trackSpy = vi
      .spyOn(mockShippingProvider, 'trackShipment')
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        return {
          trackingNumber: 'SC_TIMEOUT_TEST_123',
          carrier: 'sendcloud',
          status: 'in_transit',
          events: [],
        }
      })

    const start = Date.now()
    const result = await getBuyerOrderDetailQuery(order.id, user.id)
    const elapsed = Date.now() - start

    // Should resolve around 1 second (not block for 1.5 seconds)
    expect(elapsed).toBeLessThan(1400)
    expect(result?.shops[0].trackingStatus).toBeNull()

    trackSpy.mockRestore()
  })

  it('falls back to expired cached value if the tracking provider fails or times out', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })

    const order = await createPlatformOrder(user, { totalCents: 2500 })
    const shopOrder = await createShopOrder(order, shop, {
      shippingCostCents: 500,
      subtotalCents: 2000,
    })

    await createShippingLabel(shopOrder, {
      carrier: 'sendcloud',
      trackingNumber: 'SC_FALLBACK_TEST_123',
    })

    let mockTime = Date.now()
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockTime)
    const trackSpy = vi.spyOn(mockShippingProvider, 'trackShipment')

    // First call: should query the provider and cache it
    const res1 = await getBuyerOrderDetailQuery(order.id, user.id)
    expect(res1?.shops[0].trackingStatus).not.toBeNull()
    const firstStatus = res1?.shops[0].trackingStatus

    // Advance time by 20 minutes (TTL is 15 minutes, so it expires)
    mockTime += 20 * 60 * 1000

    // Mock trackShipment to fail/timeout
    trackSpy.mockRejectedValue(new Error('API failure'))

    // Second call: should attempt to call trackShipment, fail, but fall back to the expired cached value
    const res2 = await getBuyerOrderDetailQuery(order.id, user.id)
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
    const user = await createUser()
    const order = await createPlatformOrder(user, { totalCents: 1000 })

    const result = await getOrderOwnerId(order.id)
    expect(result).toBe(user.id)
  })
})

describe('listBuyerOrdersQuery', () => {
  it('returns empty list when user has no orders', async () => {
    const result = await listBuyerOrdersQuery('user-1', 10, 0)
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns paginated orders ordered by created_at desc', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })

    const order1 = await createPlatformOrder(user, { totalCents: 1000, status: 'paid' })
    const order2 = await createPlatformOrder(user, { totalCents: 2000, status: 'shipped' })

    await createShopOrder(order1, shop, {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'paid',
    })

    await createShopOrder(order2, shop, {
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 2000,
      status: 'shipped',
    })

    const result = await listBuyerOrdersQuery(user.id, 10, 0)
    expect(result.total).toBe(2)
    expect(result.orders).toHaveLength(2)
    // Most recent first
    expect(result.orders[0].id).toBe(order2.id)
    expect(result.orders[0].status).toBe('shipped')
    expect(result.orders[0].totalCents).toBe(2000)
    expect(result.orders[0].shopCount).toBe(1)
    expect(result.orders[0].shopSummary).toHaveLength(1)
    expect(result.orders[0].shopSummary[0].shopId).toBe(shop.id)
    expect(result.orders[0].shopSummary[0].status).toBe('shipped')
    expect(result.orders[1].id).toBe(order1.id)
    expect(result.orders[1].status).toBe('paid')
    expect(result.orders[1].shopSummary).toHaveLength(1)
    expect(result.orders[1].shopSummary[0].status).toBe('paid')
  })

  it('respects limit and offset', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })

    for (let i = 0; i < 3; i++) {
      const order = await createPlatformOrder(user, { totalCents: (i + 1) * 1000 })
      await createShopOrder(order, shop, {
        shippingCostCents: 0,
        subtotalCents: order.totalCents,
      })
    }

    const page1 = await listBuyerOrdersQuery(user.id, 2, 0)
    expect(page1.orders).toHaveLength(2)
    expect(page1.total).toBe(3)

    const page2 = await listBuyerOrdersQuery(user.id, 2, 2)
    expect(page2.orders).toHaveLength(1)
    expect(page2.total).toBe(3)
  })

  it('does not return other users orders', async () => {
    const user = await createUser()
    await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const otherUser = await createUser({ name: 'Other', email: 'other@example.com' })

    await createPlatformOrder(otherUser, { totalCents: 1000 })

    const result = await listBuyerOrdersQuery(user.id, 10, 0)
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns per-shop status summary for multi-shop orders', async () => {
    const user = await createUser()
    const shop1 = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const shop2 = await createShop(user, { name: 'Second Shop', slug: 'second-shop' })

    const order = await createPlatformOrder(user, { totalCents: 3000, status: 'paid' })

    await createShopOrder(order, shop1, {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'paid',
    })

    await createShopOrder(order, shop2, {
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 1500,
      status: 'processing',
    })

    const result = await listBuyerOrdersQuery(user.id, 10, 0)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].shopCount).toBe(2)
    expect(result.orders[0].shopSummary).toHaveLength(2)
    const s1 = result.orders[0].shopSummary.find((s) => s.shopId === shop1.id)
    const s2 = result.orders[0].shopSummary.find((s) => s.shopId === shop2.id)
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
    const user = await createUser()
    const otherUser = await createUser({ name: 'Other', email: 'other@example.com' })

    const order = await createPlatformOrder(otherUser, {
      totalCents: 1000,
      status: 'pending_payment',
    })

    try {
      await cancelOrderQuery(order.id, user.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 409 when order is not pending_payment', async () => {
    const user = await createUser()
    const order = await createPlatformOrder(user, { totalCents: 1000, status: 'paid' })

    try {
      await cancelOrderQuery(order.id, user.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('cancels platform and shop orders and releases stock', async () => {
    const user = await createUser()
    const shop = await createShop(user, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(user, {
      totalCents: 2500,
      status: 'pending_payment',
    })
    const so = await createShopOrder(order, shop, {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
      status: 'pending_payment',
    })
    await createOrderItem(so, product, { quantity: 2 })

    // Create a reservation for this order
    await createInventoryReservation(product, {
      platformOrderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cancelOrderQuery(order.id, user.id)
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
