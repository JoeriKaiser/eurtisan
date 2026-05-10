import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  orderItem,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import { type CheckoutInput, createCheckoutQuery, getCheckoutSummaryQuery } from './checkout.server'

beforeEach(async () => {
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

afterAll(async () => {
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
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

describe('getCheckoutSummaryQuery', () => {
  it('returns null for nonexistent cart', async () => {
    const result = await getCheckoutSummaryQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
    expect(result).toBeNull()
  })

  it('returns null when cart belongs to another user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await seedUser({ id: 'user-2', name: 'Other', email: 'other@example.com' })
    const c = await db
      .insert(cart)
      .values({ userId: otherUser.id })
      .returning()
      .then((rows) => rows[0])

    const result = await getCheckoutSummaryQuery(c.id, 'user-1')
    expect(result).toBeNull()
  })

  it('returns summary grouped by shop with shipping options', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })

    const result = await getCheckoutSummaryQuery(c.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result!.cartId).toBe(c.id)
    expect(result!.shops).toHaveLength(1)
    expect(result!.shops[0].shopId).toBe('shop-1')
    expect(result!.shops[0].shopName).toBe('Test Shop')
    expect(result!.shops[0].shopSlug).toBe('test-shop')
    expect(result!.shops[0].items).toHaveLength(1)
    expect(result!.shops[0].items[0].productId).toBe(p.id)
    expect(result!.shops[0].items[0].name).toBe('Vase')
    expect(result!.shops[0].items[0].quantity).toBe(2)
    expect(result!.shops[0].items[0].priceCents).toBe(1000)
    expect(result!.shops[0].shippingOptions).toHaveLength(2)
    expect(result!.shops[0].shippingOptions.map((o) => o.method)).toContain('standard')
    expect(result!.shops[0].shippingOptions.map((o) => o.method)).toContain('express')
  })

  it('calculates subtotals and grand total correctly', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p1 = await seedProduct({ id: 'prod-1', priceCents: 1000 })
    const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 2000 })

    await db.insert(cartItem).values([
      { cartId: c.id, productId: p1.id, quantity: 2 },
      { cartId: c.id, productId: p2.id, quantity: 1 },
    ])

    const result = await getCheckoutSummaryQuery(c.id, 'user-1')
    expect(result!.shops[0].subtotalCents).toBe(4000)
    expect(result!.grandTotalCents).toBe(4000)
  })

  it('groups items from multiple shops separately', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await seedShop({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop' })
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p1 = await seedProduct({ id: 'prod-1', shopId: 'shop-1', priceCents: 1000 })
    const p2 = await seedProduct({
      id: 'prod-2',
      name: 'Bowl',
      slug: 'bowl',
      shopId: shop2.id,
      priceCents: 2000,
    })

    await db.insert(cartItem).values([
      { cartId: c.id, productId: p1.id, quantity: 1 },
      { cartId: c.id, productId: p2.id, quantity: 1 },
    ])

    const result = await getCheckoutSummaryQuery(c.id, 'user-1')
    expect(result!.shops).toHaveLength(2)
    const shop1Group = result!.shops.find((s) => s.shopId === 'shop-1')
    const shop2Group = result!.shops.find((s) => s.shopId === 'shop-2')
    expect(shop1Group!.subtotalCents).toBe(1000)
    expect(shop2Group!.subtotalCents).toBe(2000)
    expect(result!.grandTotalCents).toBe(3000)
  })

  it('skips unavailable items in checkout summary', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    await db.delete(product).where(eq(product.id, p.id))

    const result = await getCheckoutSummaryQuery(c.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result!.shops).toHaveLength(0)
    expect(result!.grandTotalCents).toBe(0)
  })
})

describe('createCheckoutQuery', () => {
  function makeInput(cartId: string, overrides?: Partial<CheckoutInput>): CheckoutInput {
    return {
      cartId,
      shippingSelections: [{ shopId: 'shop-1', method: 'standard' }],
      shippingAddress: {
        name: 'Test User',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'Germany',
      },
      ...overrides,
    }
  }

  it('throws 404 when cart does not exist', async () => {
    const input = makeInput('550e8400-e29b-41d4-a716-446655440000')

    try {
      await createCheckoutQuery(input, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 404 when cart belongs to another user', async () => {
    await seedUser()
    const otherUser = await seedUser({ id: 'user-2', name: 'Other', email: 'other@example.com' })
    const c = await db
      .insert(cart)
      .values({ userId: otherUser.id })
      .returning()
      .then((rows) => rows[0])
    const input = makeInput(c.id)

    try {
      await createCheckoutQuery(input, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 409 when cart is empty', async () => {
    await seedUser()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const input = makeInput(c.id)

    try {
      await createCheckoutQuery(input, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('throws 409 with productIds when stock is exhausted', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct({ stockCount: 1 })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 5 })

    const input = makeInput(c.id)

    try {
      await createCheckoutQuery(input, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
      const body = await (err as Response).json()
      expect(body.productIds).toEqual([p.id])
    }
  })

  it('throws 409 with multiple productIds when multiple items are out of stock', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p1 = await seedProduct({ id: 'prod-1', stockCount: 1 })
    const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', stockCount: 0 })

    await db.insert(cartItem).values([
      { cartId: c.id, productId: p1.id, quantity: 5 },
      { cartId: c.id, productId: p2.id, quantity: 1 },
    ])

    const input = makeInput(c.id)

    try {
      await createCheckoutQuery(input, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
      const body = await (err as Response).json()
      expect(body.productIds).toContain(p1.id)
      expect(body.productIds).toContain(p2.id)
      expect(body.productIds).toHaveLength(2)
    }
  })

  it('throws 400 when shipping selection is missing for a shop', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 1 })

    const input = makeInput(c.id, { shippingSelections: [] })

    try {
      await createCheckoutQuery(input, 'user-1')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('creates platform_order, shop_order, and order_item records', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })

    const input = makeInput(c.id)
    const result = await createCheckoutQuery(input, 'user-1')

    expect(result.platformOrderId).toBeDefined()

    const platformOrders = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, result.platformOrderId))
    expect(platformOrders).toHaveLength(1)
    expect(platformOrders[0].userId).toBe('user-1')
    expect(platformOrders[0].totalCents).toBe(2500) // 2 * 1000 + 500 shipping
    expect(platformOrders[0].status).toBe('pending')
    expect(platformOrders[0].shippingAddress).toEqual({
      name: 'Test User',
      street: '123 Main St',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
    })

    const shopOrders = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, result.platformOrderId))
    expect(shopOrders).toHaveLength(1)
    expect(shopOrders[0].shopId).toBe('shop-1')
    expect(shopOrders[0].shippingMethod).toBe('standard')
    expect(shopOrders[0].shippingCostCents).toBe(500)
    expect(shopOrders[0].subtotalCents).toBe(2000)
    expect(shopOrders[0].status).toBe('pending')

    const orderItems = await db
      .select()
      .from(orderItem)
      .where(eq(orderItem.shopOrderId, shopOrders[0].id))
    expect(orderItems).toHaveLength(1)
    expect(orderItems[0].productId).toBe(p.id)
    expect(orderItems[0].productName).toBe('Vase')
    expect(orderItems[0].unitPriceCents).toBe(1000)
    expect(orderItems[0].quantity).toBe(2)
    expect(orderItems[0].totalCents).toBe(2000)
  })

  it('uses express shipping cost when selected', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 1 })

    const input = makeInput(c.id, {
      shippingSelections: [{ shopId: 'shop-1', method: 'express' }],
    })
    const result = await createCheckoutQuery(input, 'user-1')

    const platformOrders = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, result.platformOrderId))
    expect(platformOrders[0].totalCents).toBe(2000) // 1000 + 1000 express

    const shopOrders = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, result.platformOrderId))
    expect(shopOrders[0].shippingMethod).toBe('express')
    expect(shopOrders[0].shippingCostCents).toBe(1000)
  })

  it('creates multiple shop_orders for multi-shop carts', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await seedShop({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop' })
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p1 = await seedProduct({ id: 'prod-1', shopId: 'shop-1', priceCents: 1000 })
    const p2 = await seedProduct({
      id: 'prod-2',
      name: 'Bowl',
      slug: 'bowl',
      shopId: shop2.id,
      priceCents: 2000,
    })

    await db.insert(cartItem).values([
      { cartId: c.id, productId: p1.id, quantity: 1 },
      { cartId: c.id, productId: p2.id, quantity: 1 },
    ])

    const input = makeInput(c.id, {
      shippingSelections: [
        { shopId: 'shop-1', method: 'standard' },
        { shopId: 'shop-2', method: 'express' },
      ],
    })
    const result = await createCheckoutQuery(input, 'user-1')

    const platformOrders = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, result.platformOrderId))
    expect(platformOrders[0].totalCents).toBe(4500) // 1000+500 + 2000+1000

    const shopOrdersResult = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, result.platformOrderId))
    expect(shopOrdersResult).toHaveLength(2)

    const so1 = shopOrdersResult.find((so) => so.shopId === 'shop-1')
    const so2 = shopOrdersResult.find((so) => so.shopId === 'shop-2')
    expect(so1!.subtotalCents).toBe(1000)
    expect(so1!.shippingCostCents).toBe(500)
    expect(so2!.subtotalCents).toBe(2000)
    expect(so2!.shippingCostCents).toBe(1000)
  })

  it('clears cart and items after successful order creation', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 1 })

    const input = makeInput(c.id)
    await createCheckoutQuery(input, 'user-1')

    const cartsAfter = await db.select().from(cart).where(eq(cart.id, c.id))
    expect(cartsAfter).toHaveLength(0)

    const itemsAfter = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
    expect(itemsAfter).toHaveLength(0)
  })

  it('returns platformOrderId on success', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 1 })

    const input = makeInput(c.id)
    const result = await createCheckoutQuery(input, 'user-1')

    expect(result.platformOrderId).toBeDefined()
    expect(typeof result.platformOrderId).toBe('string')
  })

  it('does not trust client-provided totals', async () => {
    await seedUser()
    await seedShop()
    const c = await db
      .insert(cart)
      .values({ userId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p = await seedProduct({ priceCents: 1234 })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 3 })

    const input = makeInput(c.id)
    const result = await createCheckoutQuery(input, 'user-1')

    const platformOrders = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, result.platformOrderId))
    // 3 * 1234 + 500 = 4202
    expect(platformOrders[0].totalCents).toBe(4202)
  })
})
