import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, shop, shopOrder, user } from '#/db/schema'

import { getShopOrderQuery, listShopOrdersQuery } from './shop-orders.server'

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
      name: 'Test',
      email: 'test@example.com',
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

describe('getShopOrderQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getShopOrderQuery('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toBeNull()
  })

  it('returns shop order with items, buyer and shipping address', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 2500,
        status: 'paid',
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
        status: 'paid',
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

    const result = await getShopOrderQuery(so.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(so.id)
    expect(result?.platformOrderId).toBe(order.id)
    expect(result?.shopId).toBe('shop-1')
    expect(result?.status).toBe('paid')
    expect(result?.shippingMethod).toBe('standard')
    expect(result?.shippingCostCents).toBe(500)
    expect(result?.subtotalCents).toBe(2000)
    expect(result?.buyer.id).toBe('user-1')
    expect(result?.buyer.name).toBe('Test')
    expect(result?.shippingAddress.name).toBe('Test Buyer')
    expect(result?.shippingAddress.city).toBe('Berlin')
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].productName).toBe('Vase')
    expect(result?.items[0].quantity).toBe(2)
  })

  it('returns order with tracking info', async () => {
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
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'express',
        shippingCostCents: 1000,
        subtotalCents: 0,
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://track.example.com/123',
      })
      .returning()

    const result = await getShopOrderQuery(so.id)
    expect(result?.trackingNumber).toBe('TRACK123')
    expect(result?.trackingUrl).toBe('https://track.example.com/123')
  })
})

describe('listShopOrdersQuery', () => {
  it('returns empty list when shop has no orders', async () => {
    await seedUser()
    await seedShop()

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it('returns paginated orders for a shop', async () => {
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
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 2500,
        status: 'paid',
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
        status: 'paid',
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

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(result.orders[0].id).toBe(so.id)
    expect(result.orders[0].status).toBe('paid')
    expect(result.orders[0].buyerName).toBe('Test')
    expect(result.orders[0].buyerEmail).toBe('test@example.com')
    expect(result.orders[0].itemCount).toBe(1)
    expect(result.orders[0].totalCents).toBe(2500)
  })

  it('filters by status', async () => {
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
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 500,
      status: 'paid',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 500,
      status: 'shipped',
    })

    const paidResult = await listShopOrdersQuery('shop-1', { status: 'paid' })
    expect(paidResult.orders).toHaveLength(1)
    expect(paidResult.orders[0].status).toBe('paid')

    const shippedResult = await listShopOrdersQuery('shop-1', { status: 'shipped' })
    expect(shippedResult.orders).toHaveLength(1)
    expect(shippedResult.orders[0].status).toBe('shipped')
  })

  it('applies pagination correctly', async () => {
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
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    for (let i = 0; i < 5; i++) {
      await db.insert(shopOrder).values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 100,
        status: 'paid',
      })
    }

    const page1 = await listShopOrdersQuery('shop-1', { page: 1, pageSize: 2 })
    expect(page1.orders).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.totalPages).toBe(3)

    const page2 = await listShopOrdersQuery('shop-1', { page: 2, pageSize: 2 })
    expect(page2.orders).toHaveLength(2)
    expect(page2.page).toBe(2)

    const page3 = await listShopOrdersQuery('shop-1', { page: 3, pageSize: 2 })
    expect(page3.orders).toHaveLength(1)
    expect(page3.page).toBe(3)
  })

  it('only returns orders for the specified shop', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await db
      .insert(shop)
      .values({
        id: 'shop-2',
        name: 'Other Shop',
        slug: 'other-shop',
        ownerId: 'user-1',
      })
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
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 100,
      status: 'paid',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: shop2.id,
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 100,
      status: 'paid',
    })

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('returns item count for each order', async () => {
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
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values([
      {
        shopOrderId: so.id,
        productId: p.id,
        productName: 'Vase',
        unitPriceCents: 500,
        quantity: 1,
        totalCents: 500,
      },
      {
        shopOrderId: so.id,
        productId: p.id,
        productName: 'Bowl',
        unitPriceCents: 400,
        quantity: 1,
        totalCents: 400,
      },
    ])

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders[0].itemCount).toBe(2)
  })
})
