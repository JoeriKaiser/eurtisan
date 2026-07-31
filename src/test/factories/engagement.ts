import { db } from '#/db/index'
import * as schema from '#/db/schema'
import type { ShopOrderLike, UserLike } from '#/test/helpers'

export async function createCart(
  user: UserLike | string,
  overrides?: Partial<typeof schema.cart.$inferInsert>,
): Promise<typeof schema.cart.$inferSelect> {
  const userId = typeof user === 'string' ? user : user.id
  const [row] = await db
    .insert(schema.cart)
    .values({
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning()
  return row
}

export async function createCartItem(
  cart: { id: string } | string,
  product: { id: string } | string,
  overrides?: Partial<typeof schema.cartItem.$inferInsert>,
): Promise<typeof schema.cartItem.$inferSelect> {
  const cartId = typeof cart === 'string' ? cart : cart.id
  const productId = typeof product === 'string' ? product : product.id
  const [row] = await db
    .insert(schema.cartItem)
    .values({
      cartId,
      productId,
      quantity: 1,
      ...overrides,
    })
    .returning()
  return row
}

export async function createReview(
  shopOrder: ShopOrderLike | string,
  product: { id: string } | string,
  buyer: UserLike | string,
  overrides?: Partial<typeof schema.review.$inferInsert>,
): Promise<typeof schema.review.$inferSelect> {
  const shopOrderId = typeof shopOrder === 'string' ? shopOrder : shopOrder.id
  const productId = typeof product === 'string' ? product : product.id
  const buyerUserId = typeof buyer === 'string' ? buyer : buyer.id
  const [row] = await db
    .insert(schema.review)
    .values({
      shopOrderId,
      productId,
      buyerUserId,
      rating: 5,
      ...overrides,
    })
    .returning()
  return row
}

export async function createDispute(
  shopOrder: ShopOrderLike | string,
  buyer: UserLike | string,
  overrides?: Partial<typeof schema.dispute.$inferInsert>,
): Promise<typeof schema.dispute.$inferSelect> {
  const shopOrderId = typeof shopOrder === 'string' ? shopOrder : shopOrder.id
  const buyerUserId = typeof buyer === 'string' ? buyer : buyer.id
  const [row] = await db
    .insert(schema.dispute)
    .values({
      shopOrderId,
      buyerUserId,
      reason: 'Item not as described',
      description: 'The product does not match the listing.',
      status: 'open',
      ...overrides,
    })
    .returning()
  return row
}

export async function createDisputeMessage(
  dispute: { id: string } | string,
  sender: UserLike | string,
  overrides?: Partial<typeof schema.disputeMessage.$inferInsert>,
): Promise<typeof schema.disputeMessage.$inferSelect> {
  const disputeId = typeof dispute === 'string' ? dispute : dispute.id
  const senderUserId = typeof sender === 'string' ? sender : sender.id
  const [row] = await db
    .insert(schema.disputeMessage)
    .values({
      disputeId,
      senderUserId,
      message: 'Test dispute message',
      ...overrides,
    })
    .returning()
  return row
}

export async function createNotification(
  user: UserLike | string,
  overrides?: Partial<typeof schema.notification.$inferInsert>,
): Promise<typeof schema.notification.$inferSelect> {
  const userId = typeof user === 'string' ? user : user.id
  const [row] = await db
    .insert(schema.notification)
    .values({
      userId,
      // Was `'welcome'`, a type the application enum never contained — the
      // column was `text`, so nothing rejected it and the read path would have
      // rendered it as a row with no icon and no text. Promoting the column to
      // an enum is what surfaced it.
      type: 'order_placed',
      data: {},
      ...overrides,
    })
    .returning()
  return row
}
