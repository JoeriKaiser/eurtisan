import '@tanstack/react-start/server-only'

import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shopOrder } from '#/db/schema'
import { releaseStockInTx } from '../inventory.server'
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
  const [order] = await db
    .select({ status: platformOrder.status })
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (order?.status === 'pending_payment') {
    await db.transaction(async (tx) => {
      const now = new Date()
      await tx
        .update(platformOrder)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancellationReason: 'Abandoned: cart rebuilt by buyer',
          updatedAt: now,
        })
        .where(eq(platformOrder.id, platformOrderId))
      await tx
        .update(shopOrder)
        .set({ status: 'cancelled', updatedAt: now })
        .where(eq(shopOrder.platformOrderId, platformOrderId))
      await releaseStockInTx(tx, platformOrderId)
    })
  }

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
