import { getCookie, setCookie } from '@tanstack/react-start/server'
import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { cart, cartItem, product, productImage, shop } from '#/db/schema'
import { getAvailableStock, getAvailableStockForProducts } from './inventory.server'

export const ANONYMOUS_SESSION_COOKIE = 'eurtisan_session'
export const AUTH_CART_DAYS = 30
export const ANON_CART_DAYS = 7

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  path: '/',
}

export function getAnonymousSessionIdFromCookie(): string | undefined {
  return getCookie(ANONYMOUS_SESSION_COOKIE) ?? undefined
}

export function setAnonymousSessionCookie(sessionId: string): void {
  setCookie(ANONYMOUS_SESSION_COOKIE, sessionId, COOKIE_OPTIONS)
}

export function clearAnonymousSessionCookie(): void {
  setCookie(ANONYMOUS_SESSION_COOKIE, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  })
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export function generateSessionId(): string {
  return crypto.randomUUID()
}

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface CartProductDetail {
  id: string
  name: string
  slug: string
  priceCents: number
  stockCount: number
  imageUrl: string | null
}

export interface CartItemDetail {
  id: string
  productId: string
  quantity: number
  product: CartProductDetail | null
  unavailable: boolean
  stockWarning: boolean
}

export interface CartShopGroup {
  shopId: string | null
  shopName: string | null
  shopSlug: string | null
  items: CartItemDetail[]
  subtotalCents: number
}

export interface CartDetail {
  id: string
  userId: string | null
  sessionId: string | null
  expiresAt: Date | null
  shops: CartShopGroup[]
  totalCents: number
  totalItems: number
}

/* -------------------------------------------------------------------------- */
/*                               Cart Retrieval                               */
/* -------------------------------------------------------------------------- */

export async function getCartWithItemsBySessionId(sessionId: string) {
  const cartRecord = await db.select().from(cart).where(eq(cart.sessionId, sessionId)).limit(1)
  if (cartRecord.length === 0) return null

  const items = await db.select().from(cartItem).where(eq(cartItem.cartId, cartRecord[0].id))
  return { ...cartRecord[0], items }
}

export async function getCartWithItemsByUserId(userId: string) {
  const cartRecord = await db.select().from(cart).where(eq(cart.userId, userId)).limit(1)
  if (cartRecord.length === 0) return null

  const items = await db.select().from(cartItem).where(eq(cartItem.cartId, cartRecord[0].id))
  return { ...cartRecord[0], items }
}

export async function getCartDetailsBySessionId(sessionId: string): Promise<CartDetail | null> {
  const cartRecord = await db.select().from(cart).where(eq(cart.sessionId, sessionId)).limit(1)
  if (cartRecord.length === 0) return null
  return buildCartDetail(cartRecord[0])
}

export async function getCartDetailsByUserId(userId: string): Promise<CartDetail | null> {
  const cartRecord = await db.select().from(cart).where(eq(cart.userId, userId)).limit(1)
  if (cartRecord.length === 0) return null
  return buildCartDetail(cartRecord[0])
}

async function buildCartDetail(cartRecord: typeof cart.$inferSelect): Promise<CartDetail> {
  const rows = await db
    .select({
      item: cartItem,
      product: product,
      shop: shop,
    })
    .from(cartItem)
    .leftJoin(product, eq(cartItem.productId, product.id))
    .leftJoin(shop, eq(product.shopId, shop.id))
    .where(eq(cartItem.cartId, cartRecord.id))

  const productIds = rows.map((r) => r.product?.id).filter((id): id is string => !!id)

  const images =
    productIds.length > 0
      ? await db
          .select()
          .from(productImage)
          .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))
      : []

  // Deduplicate to one image per product (defensive against duplicate sortOrder = 0)
  const imageByProduct = new Map<string, string>()
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url)
    }
  }

  const availableStockMap = await getAvailableStockForProducts(productIds)

  const groups = new Map<string | null, CartShopGroup>()

  for (const row of rows) {
    const productRecord = row.product
    const shopRecord = row.shop

    const isUnavailable =
      !productRecord || productRecord.isActive === false || shopRecord?.isSuspended === true

    const availableStock = productRecord ? (availableStockMap.get(productRecord.id) ?? 0) : 0

    const itemDetail: CartItemDetail = {
      id: row.item.id,
      productId: row.item.productId,
      quantity: row.item.quantity,
      product: productRecord
        ? {
            id: productRecord.id,
            name: productRecord.name,
            slug: productRecord.slug,
            priceCents: productRecord.priceCents,
            stockCount: availableStock,
            imageUrl: productRecord ? (imageByProduct.get(productRecord.id) ?? null) : null,
          }
        : null,
      unavailable: isUnavailable,
      stockWarning: !isUnavailable && productRecord ? row.item.quantity > availableStock : false,
    }

    const shopId = shopRecord?.id ?? null
    const existing = groups.get(shopId)

    if (existing) {
      existing.items.push(itemDetail)
      if (!isUnavailable && productRecord) {
        existing.subtotalCents +=
          productRecord.priceCents * Math.min(row.item.quantity, availableStock)
      }
    } else {
      groups.set(shopId, {
        shopId,
        shopName: shopRecord?.name ?? (isUnavailable ? 'Unavailable' : null),
        shopSlug: shopRecord?.slug ?? null,
        items: [itemDetail],
        subtotalCents:
          !isUnavailable && productRecord
            ? productRecord.priceCents * Math.min(row.item.quantity, availableStock)
            : 0,
      })
    }
  }

  const shopGroups = Array.from(groups.values())
  const totalCents = shopGroups.reduce((sum, g) => sum + g.subtotalCents, 0)
  const totalItems = rows.reduce((sum, r) => sum + r.item.quantity, 0)

  return {
    id: cartRecord.id,
    userId: cartRecord.userId,
    sessionId: cartRecord.sessionId,
    expiresAt: cartRecord.expiresAt,
    shops: shopGroups,
    totalCents,
    totalItems,
  }
}

/* -------------------------------------------------------------------------- */
/*                               Cart Creation                                */
/* -------------------------------------------------------------------------- */

export async function createAnonymousCart(sessionId: string) {
  const [newCart] = await db
    .insert(cart)
    .values({
      sessionId,
      expiresAt: daysFromNow(ANON_CART_DAYS),
    })
    .returning()
  return newCart
}

export async function createUserCart(userId: string) {
  const [newCart] = await db
    .insert(cart)
    .values({
      userId,
      expiresAt: daysFromNow(AUTH_CART_DAYS),
    })
    .returning()
  return newCart
}

/* -------------------------------------------------------------------------- */
/*                               Cart Mutations                               */
/* -------------------------------------------------------------------------- */

export async function addItemToCart(cartId: string, productId: string, quantity: number) {
  const availableStock = await getAvailableStock(productId)

  const existing = await db
    .select()
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    .limit(1)

  if (existing.length > 0) {
    const newQty = Math.min(existing[0].quantity + quantity, availableStock)
    if (newQty <= 0) {
      await db.delete(cartItem).where(eq(cartItem.id, existing[0].id))
      return null
    }
    const [updated] = await db
      .update(cartItem)
      .set({ quantity: newQty, updatedAt: new Date() })
      .where(eq(cartItem.id, existing[0].id))
      .returning()
    return updated
  }

  const finalQty = Math.min(quantity, availableStock)
  if (finalQty <= 0) {
    return null
  }

  const [newItem] = await db
    .insert(cartItem)
    .values({
      cartId,
      productId,
      quantity: finalQty,
    })
    .returning()
  return newItem
}

export async function updateCartItemQuantity(cartId: string, productId: string, quantity: number) {
  if (quantity <= 0) {
    await db
      .delete(cartItem)
      .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    return null
  }

  const availableStock = await getAvailableStock(productId)
  const cappedQty = Math.min(quantity, availableStock)

  if (cappedQty <= 0) {
    await db
      .delete(cartItem)
      .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    return null
  }

  const existing = await db
    .select()
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    .limit(1)

  if (existing.length === 0) {
    const [newItem] = await db
      .insert(cartItem)
      .values({
        cartId,
        productId,
        quantity: cappedQty,
      })
      .returning()
    return newItem
  }

  const [updated] = await db
    .update(cartItem)
    .set({ quantity: cappedQty, updatedAt: new Date() })
    .where(eq(cartItem.id, existing[0].id))
    .returning()
  return updated
}

export async function removeItemFromCart(cartId: string, productId: string) {
  await db
    .delete(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
}

export async function touchCartExpiry(cartId: string, days: number = AUTH_CART_DAYS) {
  await db
    .update(cart)
    .set({ expiresAt: daysFromNow(days), updatedAt: new Date() })
    .where(eq(cart.id, cartId))
}

/* -------------------------------------------------------------------------- */
/*                               Cart Merge                                   */
/* -------------------------------------------------------------------------- */

export async function mergeAnonymousCartIntoUserCart(sessionId: string, userId: string) {
  await db.transaction(async (tx) => {
    const anonCartRows = await tx.select().from(cart).where(eq(cart.sessionId, sessionId)).limit(1)
    if (anonCartRows.length === 0) return

    const anonCartId = anonCartRows[0].id
    const anonItems = await tx.select().from(cartItem).where(eq(cartItem.cartId, anonCartId))
    if (anonItems.length === 0) {
      await tx.delete(cart).where(eq(cart.id, anonCartId))
      return
    }

    const userCartRows = await tx.select().from(cart).where(eq(cart.userId, userId)).limit(1)
    let userCartId: string
    if (userCartRows.length === 0) {
      const [newCart] = await tx
        .insert(cart)
        .values({
          userId,
          expiresAt: daysFromNow(AUTH_CART_DAYS),
        })
        .returning()
      userCartId = newCart.id
    } else {
      userCartId = userCartRows[0].id
      await tx
        .update(cart)
        .set({ expiresAt: daysFromNow(AUTH_CART_DAYS) })
        .where(eq(cart.id, userCartId))
    }

    const productIds = anonItems.map((item) => item.productId)
    const products = await tx.select().from(product).where(inArray(product.id, productIds))

    // Fetch available stock for all products in the merge
    const availableStockMap = await getAvailableStockForProducts(productIds)

    // Batch-fetch all existing user cart items to avoid N+1 per anonymous item
    const existingUserItems = await tx
      .select()
      .from(cartItem)
      .where(and(eq(cartItem.cartId, userCartId), inArray(cartItem.productId, productIds)))
    const existingByProductId = new Map(existingUserItems.map((item) => [item.productId, item]))

    for (const anonItem of anonItems) {
      const productRecord = products.find((p) => p.id === anonItem.productId)
      if (!productRecord) continue

      const existingItem = existingByProductId.get(anonItem.productId)

      const combinedQuantity = existingItem
        ? existingItem.quantity + anonItem.quantity
        : anonItem.quantity
      const availableStock = availableStockMap.get(productRecord.id) ?? 0
      const cappedQuantity = Math.min(combinedQuantity, availableStock)

      if (cappedQuantity <= 0) {
        if (existingItem) {
          await tx.delete(cartItem).where(eq(cartItem.id, existingItem.id))
        }
        continue
      }

      if (existingItem) {
        await tx
          .update(cartItem)
          .set({ quantity: cappedQuantity, updatedAt: new Date() })
          .where(eq(cartItem.id, existingItem.id))
      } else {
        await tx.insert(cartItem).values({
          cartId: userCartId,
          productId: anonItem.productId,
          quantity: cappedQuantity,
        })
      }
    }

    await tx.delete(cart).where(eq(cart.id, anonCartId))
  })
}

export async function handlePostLoginCartMerge(
  sessionId: string | undefined,
  userId: string,
  clearCookie: () => void,
) {
  if (sessionId) {
    await mergeAnonymousCartIntoUserCart(sessionId, userId)
    clearCookie()
  }
}

/* -------------------------------------------------------------------------- */
/*                            Expired Cart Cleanup                            */
/* -------------------------------------------------------------------------- */

export async function clearExpiredCarts() {
  const now = new Date()
  await db.delete(cart).where(and(gt(cart.expiresAt, new Date(0)), gt(sql`${now}`, cart.expiresAt)))
}

// Backward-compatible alias
export const cleanupExpiredCarts = clearExpiredCarts
