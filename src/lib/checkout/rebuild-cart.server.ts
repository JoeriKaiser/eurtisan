import '@tanstack/react-start/server-only'

import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, shopOrder } from '#/db/schema'
import {
  ANON_CART_DAYS,
  AUTH_CART_DAYS,
  addItemToCart,
  createAnonymousCart,
  createUserCart,
  generateSessionId,
  getAnonymousSessionIdFromCookie,
  getCartWithItemsBySessionId,
  getCartWithItemsByUserId,
  setAnonymousSessionCookie,
  touchCartExpiry,
} from '../cart.server'

export async function rebuildCartFromOrderQuery(
  platformOrderId: string,
  userId: string | null,
): Promise<{ added: number; skipped: number }> {
  const items = await db
    .select({ productId: orderItem.productId, quantity: orderItem.quantity })
    .from(orderItem)
    .innerJoin(shopOrder, eq(orderItem.shopOrderId, shopOrder.id))
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  let cartId: string
  let expiryDays: number
  if (userId) {
    const existing = await getCartWithItemsByUserId(userId)
    cartId = existing?.id ?? (await createUserCart(userId)).id
    expiryDays = AUTH_CART_DAYS
  } else {
    let sessionId = getAnonymousSessionIdFromCookie()
    if (!sessionId) {
      sessionId = generateSessionId()
      setAnonymousSessionCookie(sessionId)
    }
    const existing = await getCartWithItemsBySessionId(sessionId)
    cartId = existing?.id ?? (await createAnonymousCart(sessionId)).id
    expiryDays = ANON_CART_DAYS
  }

  let added = 0
  let skipped = 0
  for (const item of items) {
    try {
      await addItemToCart(cartId, item.productId, item.quantity)
      added += 1
    } catch {
      skipped += 1
    }
  }
  await touchCartExpiry(cartId, expiryDays)
  return { added, skipped }
}
