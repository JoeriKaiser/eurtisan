import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { cart, cartItem, product, productImage, shop, user } from '#/db/schema'

import {
  ANON_CART_DAYS,
  AUTH_CART_DAYS,
  addItemToCart,
  cleanupExpiredCarts,
  clearExpiredCarts,
  createAnonymousCart,
  createUserCart,
  generateSessionId,
  getCartDetailsBySessionId,
  getCartDetailsByUserId,
  getCartWithItemsBySessionId,
  getCartWithItemsByUserId,
  handlePostLoginCartMerge,
  mergeAnonymousCartIntoUserCart,
  removeItemFromCart,
  touchCartExpiry,
  updateCartItemQuantity,
} from './cart.server'

beforeEach(async () => {
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedShop() {
  return db
    .insert(shop)
    .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: 'user-1' })
    .returning()
    .then((rows) => rows[0])
}

async function seedUser() {
  return db
    .insert(user)
    .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
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

describe('generateSessionId', () => {
  it('returns a UUID string', () => {
    const id = generateSessionId()
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('returns unique values on successive calls', () => {
    const id1 = generateSessionId()
    const id2 = generateSessionId()
    expect(id1).not.toBe(id2)
  })
})

describe('createAnonymousCart', () => {
  it('creates a cart with sessionId and 7-day expiry', async () => {
    const sessionId = generateSessionId()
    const result = await createAnonymousCart(sessionId)

    expect(result.sessionId).toBe(sessionId)
    expect(result.userId).toBeNull()
    expect(result.expiresAt).not.toBeNull()

    const expectedMax = Date.now() + ANON_CART_DAYS * 24 * 60 * 60 * 1000
    const expectedMin = Date.now() + (ANON_CART_DAYS - 1) * 24 * 60 * 60 * 1000
    expect(result.expiresAt?.getTime()).toBeGreaterThan(expectedMin)
    expect(result.expiresAt?.getTime()).toBeLessThanOrEqual(expectedMax)
  })
})

describe('createUserCart', () => {
  it('creates a cart with userId and 30-day expiry', async () => {
    const u = await seedUser()
    const result = await createUserCart(u.id)

    expect(result.userId).toBe(u.id)
    expect(result.sessionId).toBeNull()
    expect(result.expiresAt).not.toBeNull()

    const expectedMax = Date.now() + AUTH_CART_DAYS * 24 * 60 * 60 * 1000
    const expectedMin = Date.now() + (AUTH_CART_DAYS - 1) * 24 * 60 * 60 * 1000
    expect(result.expiresAt?.getTime()).toBeGreaterThan(expectedMin)
    expect(result.expiresAt?.getTime()).toBeLessThanOrEqual(expectedMax)
  })
})

describe('getCartWithItemsBySessionId', () => {
  it('returns cart with items', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 3 })

    const result = await getCartWithItemsBySessionId(sessionId)
    expect(result).not.toBeNull()
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].quantity).toBe(3)
  })

  it('returns null for nonexistent session', async () => {
    const result = await getCartWithItemsBySessionId('nonexistent')
    expect(result).toBeNull()
  })
})

describe('getCartWithItemsByUserId', () => {
  it('returns cart with items', async () => {
    await seedUser()
    await seedShop()
    const u = await db
      .select()
      .from(user)
      .where(eq(user.id, 'user-1'))
      .limit(1)
      .then((rows) => rows[0])
    const c = await createUserCart(u.id)
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })

    const result = await getCartWithItemsByUserId(u.id)
    expect(result).not.toBeNull()
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].quantity).toBe(2)
  })

  it('returns null for user without cart', async () => {
    const result = await getCartWithItemsByUserId('nonexistent')
    expect(result).toBeNull()
  })
})

describe('addItemToCart', () => {
  it('adds a new item to cart', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    const item = await addItemToCart(c.id, p.id, 5)
    expect(item!.productId).toBe(p.id)
    expect(item!.quantity).toBe(5)
  })

  it('increments quantity for existing item', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    await addItemToCart(c.id, p.id, 3)
    const item = await addItemToCart(c.id, p.id, 2)
    expect(item!.quantity).toBe(5)
  })

  it('caps quantity at product stock', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ stockCount: 5 })

    const item = await addItemToCart(c.id, p.id, 10)
    expect(item!.quantity).toBe(5)
  })

  it('caps existing + new quantity at stock', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ stockCount: 5 })

    await addItemToCart(c.id, p.id, 3)
    const item = await addItemToCart(c.id, p.id, 5)
    expect(item!.quantity).toBe(5)
  })

  it('returns null when stock is zero', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ stockCount: 0 })

    const item = await addItemToCart(c.id, p.id, 3)
    expect(item).toBeNull()
  })

  it('deletes existing item when capped to zero stock', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ stockCount: 0 })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    const item = await addItemToCart(c.id, p.id, 1)
    expect(item).toBeNull()

    const remaining = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
    expect(remaining).toHaveLength(0)
  })
})

describe('mergeAnonymousCartIntoUserCart', () => {
  async function seedProducts() {
    return db
      .insert(product)
      .values([
        { id: 'prod-a', name: 'A', slug: 'a', priceCents: 100, stockCount: 10, shopId: 'shop-1' },
        { id: 'prod-b', name: 'B', slug: 'b', priceCents: 200, stockCount: 5, shopId: 'shop-1' },
        { id: 'prod-c', name: 'C', slug: 'c', priceCents: 300, stockCount: 1, shopId: 'shop-1' },
      ])
      .returning()
  }

  it('creates user cart when none exists and transfers items', async () => {
    const u = await seedUser()
    await seedShop()
    await seedProducts()
    const sessionId = generateSessionId()
    const anonCart = await createAnonymousCart(sessionId)
    await addItemToCart(anonCart.id, 'prod-a', 2)

    await mergeAnonymousCartIntoUserCart(sessionId, u.id)

    const userCart = await getCartWithItemsByUserId(u.id)
    expect(userCart).not.toBeNull()
    expect(userCart?.items).toHaveLength(1)
    expect(userCart?.items[0].productId).toBe('prod-a')
    expect(userCart?.items[0].quantity).toBe(2)

    const anonCartAfter = await getCartWithItemsBySessionId(sessionId)
    expect(anonCartAfter).toBeNull()
  })

  it('merges items into existing user cart', async () => {
    const u = await seedUser()
    await seedShop()
    await seedProducts()
    const userCart = await createUserCart(u.id)
    await addItemToCart(userCart.id, 'prod-a', 3)

    const sessionId = generateSessionId()
    const anonCart = await createAnonymousCart(sessionId)
    await addItemToCart(anonCart.id, 'prod-a', 2)
    await addItemToCart(anonCart.id, 'prod-b', 1)

    await mergeAnonymousCartIntoUserCart(sessionId, u.id)

    const mergedCart = await getCartWithItemsByUserId(u.id)
    expect(mergedCart).not.toBeNull()
    expect(mergedCart?.items).toHaveLength(2)

    const itemA = mergedCart?.items.find((i) => i.productId === 'prod-a')
    const itemB = mergedCart?.items.find((i) => i.productId === 'prod-b')

    expect(itemA?.quantity).toBe(5)
    expect(itemB?.quantity).toBe(1)
  })

  it('caps merged quantity at product stock', async () => {
    const u = await seedUser()
    await seedShop()
    await seedProducts()
    const userCart = await createUserCart(u.id)
    await addItemToCart(userCart.id, 'prod-b', 3)

    const sessionId = generateSessionId()
    const anonCart = await createAnonymousCart(sessionId)
    await addItemToCart(anonCart.id, 'prod-b', 4)

    await mergeAnonymousCartIntoUserCart(sessionId, u.id)

    const mergedCart = await getCartWithItemsByUserId(u.id)
    const itemB = mergedCart?.items.find((i) => i.productId === 'prod-b')
    expect(itemB?.quantity).toBe(5)
  })

  it('handles anonymous cart with no items by deleting it', async () => {
    const u = await seedUser()
    const sessionId = generateSessionId()
    await createAnonymousCart(sessionId)

    await mergeAnonymousCartIntoUserCart(sessionId, u.id)

    const userCart = await getCartWithItemsByUserId(u.id)
    expect(userCart).toBeNull()

    const anonCartAfter = await getCartWithItemsBySessionId(sessionId)
    expect(anonCartAfter).toBeNull()
  })

  it('does nothing when no anonymous cart exists', async () => {
    const u = await seedUser()
    await mergeAnonymousCartIntoUserCart('nonexistent', u.id)

    const userCart = await getCartWithItemsByUserId(u.id)
    expect(userCart).toBeNull()
  })

  it('caps quantity at stock when user already has full stock', async () => {
    const u = await seedUser()
    await seedShop()
    await seedProducts()
    const userCart = await createUserCart(u.id)
    await addItemToCart(userCart.id, 'prod-c', 1)

    const sessionId = generateSessionId()
    const anonCart = await createAnonymousCart(sessionId)
    await addItemToCart(anonCart.id, 'prod-c', 5)

    await mergeAnonymousCartIntoUserCart(sessionId, u.id)

    const mergedCart = await getCartWithItemsByUserId(u.id)
    const itemC = mergedCart?.items.find((i) => i.productId === 'prod-c')
    expect(itemC?.quantity).toBe(1)
  })
})

describe('touchCartExpiry', () => {
  it('updates the cart expiry to the default 30 days', async () => {
    const [c] = await db
      .insert(cart)
      .values({
        sessionId: generateSessionId(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .returning()

    await touchCartExpiry(c.id)

    const [updated] = await db.select().from(cart).where(eq(cart.id, c.id))
    const expectedMax = Date.now() + AUTH_CART_DAYS * 24 * 60 * 60 * 1000
    const expectedMin = Date.now() + (AUTH_CART_DAYS - 1) * 24 * 60 * 60 * 1000
    expect(updated?.expiresAt?.getTime()).toBeGreaterThan(expectedMin)
    expect(updated?.expiresAt?.getTime()).toBeLessThanOrEqual(expectedMax)
  })

  it('accepts a custom day count', async () => {
    const [c] = await db
      .insert(cart)
      .values({
        sessionId: generateSessionId(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .returning()

    await touchCartExpiry(c.id, 1)

    const [updated] = await db.select().from(cart).where(eq(cart.id, c.id))
    const expectedMax = Date.now() + 1 * 24 * 60 * 60 * 1000
    const expectedMin = Date.now() + 0 * 24 * 60 * 60 * 1000
    expect(updated?.expiresAt?.getTime()).toBeGreaterThan(expectedMin)
    expect(updated?.expiresAt?.getTime()).toBeLessThanOrEqual(expectedMax)
  })
})

describe('handlePostLoginCartMerge', () => {
  async function seedProducts() {
    return db
      .insert(product)
      .values([
        { id: 'prod-a', name: 'A', slug: 'a', priceCents: 100, stockCount: 10, shopId: 'shop-1' },
      ])
      .returning()
  }

  it('merges anonymous cart and calls clearCookie', async () => {
    const u = await seedUser()
    await seedShop()
    await seedProducts()
    const sessionId = generateSessionId()
    const anonCart = await createAnonymousCart(sessionId)
    await addItemToCart(anonCart.id, 'prod-a', 2)

    let cleared = false
    await handlePostLoginCartMerge(sessionId, u.id, () => {
      cleared = true
    })

    expect(cleared).toBe(true)
    const userCart = await getCartWithItemsByUserId(u.id)
    expect(userCart?.items).toHaveLength(1)
    expect(userCart?.items[0].productId).toBe('prod-a')
    expect(userCart?.items[0].quantity).toBe(2)
  })

  it('does not call clearCookie when there is no sessionId', async () => {
    const u = await seedUser()
    let cleared = false
    await handlePostLoginCartMerge(undefined, u.id, () => {
      cleared = true
    })
    expect(cleared).toBe(false)
  })
})

describe('updateCartItemQuantity', () => {
  it('updates quantity for existing item', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    const updated = await updateCartItemQuantity(c.id, p.id, 7)
    expect(updated!.quantity).toBe(7)
  })

  it('removes item when quantity is zero', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    const result = await updateCartItemQuantity(c.id, p.id, 0)
    expect(result).toBeNull()

    const remaining = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
    expect(remaining).toHaveLength(0)
  })

  it('caps quantity at product stock', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ stockCount: 5 })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    const updated = await updateCartItemQuantity(c.id, p.id, 10)
    expect(updated!.quantity).toBe(5)
  })

  it('creates item when it does not exist', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    const result = await updateCartItemQuantity(c.id, p.id, 3)
    expect(result!.productId).toBe(p.id)
    expect(result!.quantity).toBe(3)
  })

  it('removes item when stock is zero', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ stockCount: 0 })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    const result = await updateCartItemQuantity(c.id, p.id, 1)
    expect(result).toBeNull()

    const remaining = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
    expect(remaining).toHaveLength(0)
  })
})

describe('removeItemFromCart', () => {
  it('removes item from cart', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    await removeItemFromCart(c.id, p.id)

    const remaining = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
    expect(remaining).toHaveLength(0)
  })

  it('does nothing when item does not exist', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)

    await removeItemFromCart(c.id, 'nonexistent')

    const remaining = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
    expect(remaining).toHaveLength(0)
  })
})

describe('getCartDetailsBySessionId', () => {
  it('returns null for nonexistent session', async () => {
    const result = await getCartDetailsBySessionId('nonexistent')
    expect(result).toBeNull()
  })

  it('returns cart grouped by shop with subtotals', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p1 = await seedProduct({ id: 'prod-1', name: 'Vase', slug: 'vase', priceCents: 1000 })
    const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 2000 })

    await db.insert(cartItem).values([
      { cartId: c.id, productId: p1.id, quantity: 2 },
      { cartId: c.id, productId: p2.id, quantity: 1 },
    ])

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result).not.toBeNull()
    expect(result!.shops).toHaveLength(1)
    expect(result!.shops[0].shopName).toBe('Test Shop')
    expect(result!.shops[0].items).toHaveLength(2)
    expect(result!.shops[0].subtotalCents).toBe(4000)
    expect(result!.totalCents).toBe(4000)
    expect(result!.totalItems).toBe(3)
  })

  it('marks deleted products as unavailable', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ id: 'prod-1' })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    await db.delete(product).where(eq(product.id, p.id))

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result).not.toBeNull()
    expect(result!.shops[0].items[0].unavailable).toBe(true)
    expect(result!.shops[0].items[0].product).toBeNull()
  })

  it('marks inactive products as unavailable', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ id: 'prod-1', isActive: false })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result!.shops[0].items[0].unavailable).toBe(true)
  })

  it('marks items from suspended shops as unavailable', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ id: 'prod-1' })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })
    await db.update(shop).set({ isSuspended: true }).where(eq(shop.id, 'shop-1'))

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result!.shops[0].items[0].unavailable).toBe(true)
  })

  it('surfaces stock warning when cart quantity exceeds stock', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ id: 'prod-1', stockCount: 3 })

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 5 })

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result!.shops[0].items[0].stockWarning).toBe(true)
    expect(result!.shops[0].subtotalCents).toBe(3000) // capped at stock
  })

  it('includes product image url', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ id: 'prod-1' })

    await db.insert(productImage).values({
      id: 'img-1',
      productId: p.id,
      url: 'http://example.com/vase.jpg',
      sortOrder: 0,
    })
    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 1 })

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result!.shops[0].items[0].product!.imageUrl).toBe('http://example.com/vase.jpg')
  })

  it('does not duplicate items when multiple primary images exist', async () => {
    await seedUser()
    await seedShop()
    const sessionId = generateSessionId()
    const c = await createAnonymousCart(sessionId)
    const p = await seedProduct({ id: 'prod-1' })

    await db.insert(productImage).values([
      { id: 'img-1', productId: p.id, url: 'http://example.com/a.jpg', sortOrder: 0 },
      { id: 'img-2', productId: p.id, url: 'http://example.com/b.jpg', sortOrder: 0 },
    ])
    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 2 })

    const result = await getCartDetailsBySessionId(sessionId)
    expect(result).not.toBeNull()
    expect(result!.shops).toHaveLength(1)
    expect(result!.shops[0].items).toHaveLength(1)
    expect(result!.totalItems).toBe(2)
    expect(result!.totalCents).toBe(2000)
  })
})

describe('getCartDetailsByUserId', () => {
  it('returns null for user without cart', async () => {
    const result = await getCartDetailsByUserId('nonexistent')
    expect(result).toBeNull()
  })

  it('returns user cart with grouped shops', async () => {
    await seedUser()
    await seedShop()
    const u = await db.select().from(user).where(eq(user.id, 'user-1')).limit(1).then((rows) => rows[0])
    const c = await createUserCart(u.id)
    const p = await seedProduct()

    await db.insert(cartItem).values({ cartId: c.id, productId: p.id, quantity: 4 })

    const result = await getCartDetailsByUserId(u.id)
    expect(result).not.toBeNull()
    expect(result!.shops).toHaveLength(1)
    expect(result!.totalCents).toBe(4000)
  })
})

describe('clearExpiredCarts', () => {
  it('deletes carts past their expiry', async () => {
    const sessionId = generateSessionId()
    const [expiredCart] = await db
      .insert(cart)
      .values({
        sessionId,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .returning()

    await clearExpiredCarts()

    const remaining = await db.select().from(cart).where(eq(cart.id, expiredCart.id))
    expect(remaining).toHaveLength(0)
  })

  it('keeps carts that have not expired', async () => {
    const sessionId = generateSessionId()
    const [freshCart] = await db
      .insert(cart)
      .values({
        sessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning()

    await clearExpiredCarts()

    const remaining = await db.select().from(cart).where(eq(cart.id, freshCart.id))
    expect(remaining).toHaveLength(1)
  })
})

describe('cleanupExpiredCarts alias', () => {
  it('still works as an alias for clearExpiredCarts', async () => {
    const sessionId = generateSessionId()
    const [expiredCart] = await db
      .insert(cart)
      .values({
        sessionId,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .returning()

    await cleanupExpiredCarts()

    const remaining = await db.select().from(cart).where(eq(cart.id, expiredCart.id))
    expect(remaining).toHaveLength(0)
  })
})
