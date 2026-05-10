import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { cart, cartItem, product } from '#/db/schema'

export const ANONYMOUS_SESSION_COOKIE = 'eurtisan_session'
export const AUTH_CART_DAYS = 30
export const ANON_CART_DAYS = 7

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export function generateSessionId(): string {
  return crypto.randomUUID()
}

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

export async function addItemToCart(cartId: string, productId: string, quantity: number) {
  const existing = await db
    .select()
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)))
    .limit(1)

  if (existing.length > 0) {
    const newQty = existing[0].quantity + quantity
    const [updated] = await db
      .update(cartItem)
      .set({ quantity: newQty, updatedAt: new Date() })
      .where(eq(cartItem.id, existing[0].id))
      .returning()
    return updated
  }

  const [newItem] = await db
    .insert(cartItem)
    .values({
      cartId,
      productId,
      quantity,
    })
    .returning()
  return newItem
}

export async function touchCartExpiry(cartId: string, days: number = AUTH_CART_DAYS) {
  await db
    .update(cart)
    .set({ expiresAt: daysFromNow(days), updatedAt: new Date() })
    .where(eq(cart.id, cartId))
}

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

    for (const anonItem of anonItems) {
      const productRecord = products.find((p) => p.id === anonItem.productId)
      if (!productRecord) continue

      const existingItems = await tx
        .select()
        .from(cartItem)
        .where(and(eq(cartItem.cartId, userCartId), eq(cartItem.productId, anonItem.productId)))
        .limit(1)

      const combinedQuantity =
        existingItems.length > 0 ? existingItems[0].quantity + anonItem.quantity : anonItem.quantity
      const cappedQuantity = Math.min(combinedQuantity, productRecord.stockCount)

      if (cappedQuantity <= 0) {
        if (existingItems.length > 0) {
          await tx.delete(cartItem).where(eq(cartItem.id, existingItems[0].id))
        }
        continue
      }

      if (existingItems.length > 0) {
        await tx
          .update(cartItem)
          .set({ quantity: cappedQuantity, updatedAt: new Date() })
          .where(eq(cartItem.id, existingItems[0].id))
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

export async function cleanupExpiredCarts() {
  const now = new Date()
  await db.delete(cart).where(and(gt(cart.expiresAt, new Date(0)), gt(sql`${now}`, cart.expiresAt)))
}
