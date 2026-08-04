import { getCookie, getRequestProtocol, setCookie } from '@tanstack/react-start/server'
import { and, eq, gte, inArray, isNull, lt, ne, or, sql, sum } from 'drizzle-orm'
import { db } from '#/db/index'
import { cart, cartItem, inventoryReservation, product, productImage, shop } from '#/db/schema'
import {
  getAvailableStock,
  getAvailableStockForProducts,
  getAvailableStockForProductsInTx,
  releaseCartStockInTx,
  reserveCartStockInTx,
} from '../inventory.server'
import { ANONYMOUS_SESSION_COOKIE } from './constants'
import type { CartDetail, CartItemDetail, CartShopGroup } from './types'

export const AUTH_CART_DAYS = 30
export const ANON_CART_DAYS = 7

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: getRequestProtocol() === 'https',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  }
}

export function getAnonymousSessionIdFromCookie(): string | undefined {
  return getCookie(ANONYMOUS_SESSION_COOKIE) ?? undefined
}

export function setAnonymousSessionCookie(sessionId: string): void {
  setCookie(ANONYMOUS_SESSION_COOKIE, sessionId, getCookieOptions())
}

export function clearAnonymousSessionCookie(): void {
  setCookie(ANONYMOUS_SESSION_COOKIE, '', {
    ...getCookieOptions(),
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
    const itemId = row.item.id
    const itemProductId = row.item.productId
    const itemQuantity = row.item.quantity

    const isUnavailable =
      !productRecord ||
      productRecord.status !== 'published' ||
      productRecord.isActive === false ||
      shopRecord?.isSuspended === true

    const availableStock = productRecord ? (availableStockMap.get(productRecord.id) ?? 0) : 0

    const itemDetail: CartItemDetail = {
      id: itemId,
      productId: itemProductId,
      quantity: itemQuantity,
      product: productRecord
        ? {
            id: productRecord.id,
            name: productRecord.name,
            slug: productRecord.slug,
            priceCents: productRecord.priceCents,
            stockCount: availableStock,
            imageUrl: productRecord ? (imageByProduct.get(productRecord.id) ?? null) : null,
            weightGrams: productRecord.weightGrams,
            volumeMl: productRecord.volumeMl,
            soldBy: productRecord.soldBy,
          }
        : null,
      unavailable: isUnavailable,
      stockWarning: !isUnavailable && productRecord ? itemQuantity > availableStock : false,
    }

    const shopId = shopRecord?.id ?? null
    const existing = groups.get(shopId)

    if (existing) {
      existing.items.push(itemDetail)
      if (!isUnavailable && productRecord) {
        existing.subtotalCents += productRecord.priceCents * Math.min(itemQuantity, availableStock)
      }
    } else {
      groups.set(shopId, {
        shopId,
        shopName: shopRecord?.name ?? (isUnavailable ? 'Unavailable' : null),
        shopSlug: shopRecord?.slug ?? null,
        shopIsVatRegistered: shopRecord?.isVatRegistered ?? false,
        items: [itemDetail],
        subtotalCents:
          !isUnavailable && productRecord
            ? productRecord.priceCents * Math.min(itemQuantity, availableStock)
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

const CART_RESERVATION_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function addItemToCart(cartId: string, productId: string, quantity: number) {
  return db.transaction(async (tx) => {
    // Lock product row to serialize concurrent cart mutations for this product
    const [productRow] = await tx
      .select()
      .from(product)
      .where(eq(product.id, productId))
      .for('update')

    if (!productRow) {
      throw new Error('Product not found')
    }

    // Calculate available stock inside the transaction, excluding this cart's
    // own reservation so we don't double-count when updating quantity.
    const [reservationResult] = await tx
      .select({ totalReserved: sum(inventoryReservation.quantity) })
      .from(inventoryReservation)
      .where(
        and(
          eq(inventoryReservation.productId, productId),
          gte(inventoryReservation.expiresAt, sql`now()`),
          or(isNull(inventoryReservation.cartId), ne(inventoryReservation.cartId, cartId)),
        ),
      )

    const totalReserved = Number(reservationResult?.totalReserved ?? 0)
    const availableStock = Math.max(0, productRow.stockCount - totalReserved)

    const [existingItem] = await tx
      .select()
      .from(cartItem)
      .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
      .limit(1)

    const existingQuantity = existingItem?.quantity ?? 0
    const requestedTotal = existingQuantity + quantity

    if (requestedTotal > availableStock) {
      throw new Error(`Only ${availableStock} units available`)
    }

    if (requestedTotal <= 0) {
      await tx
        .delete(cartItem)
        .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
      await releaseCartStockInTx(tx, cartId, productId)
      return null
    }

    const [result] = await tx
      .insert(cartItem)
      .values({
        cartId,
        productId,
        quantity: requestedTotal,
      })
      .onConflictDoUpdate({
        target: [cartItem.cartId, cartItem.productId],
        set: {
          quantity: requestedTotal,
          updatedAt: new Date(),
        },
      })
      .returning()

    // Upsert a lightweight cart reservation with a 1-hour TTL
    await reserveCartStockInTx(
      tx,
      cartId,
      productId,
      result.quantity,
      new Date(Date.now() + CART_RESERVATION_TTL_MS),
    )

    return result
  })
}

export async function updateCartItemQuantity(cartId: string, productId: string, quantity: number) {
  if (quantity <= 0) {
    await db
      .delete(cartItem)
      .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    await releaseCartStockInTx(db, cartId, productId)
    return null
  }

  const availableStock = await getAvailableStock(productId, cartId)
  const cappedQty = Math.min(quantity, availableStock)

  if (cappedQty <= 0) {
    await db
      .delete(cartItem)
      .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    await releaseCartStockInTx(db, cartId, productId)
    return null
  }

  const existing = await db
    .select()
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    .limit(1)

  let result: typeof cartItem.$inferSelect

  if (existing.length === 0) {
    const [newItem] = await db
      .insert(cartItem)
      .values({
        cartId,
        productId,
        quantity: cappedQty,
      })
      .returning()
    result = newItem
  } else {
    const [updated] = await db
      .update(cartItem)
      .set({ quantity: cappedQty, updatedAt: new Date() })
      .where(eq(cartItem.id, existing[0].id))
      .returning()
    result = updated
  }

  // Upsert a lightweight cart reservation with a 1-hour TTL
  await db.transaction(async (tx) => {
    await reserveCartStockInTx(
      tx,
      cartId,
      productId,
      result.quantity,
      new Date(Date.now() + CART_RESERVATION_TTL_MS),
    )
  })

  return result
}

export async function removeItemFromCart(cartId: string, productId: string) {
  await db
    .delete(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
  await releaseCartStockInTx(db, cartId, productId)
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
    const productById = new Map(products.map((p) => [p.id, p]))

    // Release anonymous cart reservations so they don't reduce available
    // stock during the merge calculation.
    await releaseCartStockInTx(tx, anonCartId)

    // Keep queries sequential on the transaction's single PostgreSQL client.
    // Exclude the user cart's own reservations so they don't double-count
    // against available inventory during the merge.
    const availableStockMap = await getAvailableStockForProductsInTx(tx, productIds, userCartId)
    const existingUserItems = await tx
      .select()
      .from(cartItem)
      .where(and(eq(cartItem.cartId, userCartId), inArray(cartItem.productId, productIds)))
    const existingByProductId = new Map(existingUserItems.map((item) => [item.productId, item]))

    for (const anonItem of anonItems) {
      const productRecord = productById.get(anonItem.productId)
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

    // Re-create cart reservations for the final user cart items (anon cart
    // reservations are cascade-deleted when the anonymous cart is removed).
    const finalUserItems = await tx.select().from(cartItem).where(eq(cartItem.cartId, userCartId))

    // Sort to guarantee deterministic lock ordering and avoid deadlocks.
    finalUserItems.sort((a, b) => a.productId.localeCompare(b.productId))

    const reservationExpiresAt = new Date(Date.now() + CART_RESERVATION_TTL_MS)
    for (const item of finalUserItems) {
      await reserveCartStockInTx(
        tx,
        userCartId,
        item.productId,
        item.quantity,
        reservationExpiresAt,
      )
    }
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

export interface CleanupExpiredCartsResult {
  deletedCount: number
}

export async function clearExpiredCarts(batchSize = 100): Promise<CleanupExpiredCartsResult> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: cart.id })
      .from(cart)
      .where(lt(cart.expiresAt, sql`now()`))
      .limit(batchSize)

    if (expired.length === 0) {
      return { deletedCount: 0 }
    }

    const ids = expired.map((r) => r.id)

    await tx.delete(cartItem).where(inArray(cartItem.cartId, ids))
    await tx.delete(cart).where(inArray(cart.id, ids))

    return { deletedCount: expired.length }
  })
}

// Backward-compatible alias
export const cleanupExpiredCarts = clearExpiredCarts
