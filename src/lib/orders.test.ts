import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import { cancelOrderQuery, getOrderByIdQuery } from './orders.server'

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

describe('getOrderByIdQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getOrderByIdQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
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

    const result = await getOrderByIdQuery(order.id, 'user-1')
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

    const result = await getOrderByIdQuery(order.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(order.id)
    expect(result?.totalCents).toBe(2500)
    expect(result?.shops).toHaveLength(1)
    expect(result?.shops[0].shopId).toBe('shop-1')
    expect(result?.shops[0].shopName).toBe('Test Shop')
    expect(result?.shops[0].shippingMethod).toBe('standard')
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

    const result = await getOrderByIdQuery(order.id, 'user-1')
    expect(result?.shops).toHaveLength(2)
    const group1 = result?.shops.find((s) => s.shopId === 'shop-1')
    const group2 = result?.shops.find((s) => s.shopId === 'shop-2')
    expect(group1?.shippingMethod).toBe('standard')
    expect(group2?.shippingMethod).toBe('express')
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
        shippingAddress: { name: 'Other', street: 'St', city: 'City', postalCode: '00000', country: 'DE' },
        billingAddress: { name: 'Other', street: 'St', city: 'City', postalCode: '00000', country: 'DE' },
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
        shippingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '12345', country: 'DE' },
        billingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '12345', country: 'DE' },
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
        shippingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '12345', country: 'DE' },
        billingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '12345', country: 'DE' },
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

    const [updatedShopOrder] = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, so.id))
    expect(updatedShopOrder.status).toBe('cancelled')

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))
    expect(reservations).toHaveLength(0)
  })
})
