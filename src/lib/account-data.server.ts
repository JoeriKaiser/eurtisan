import { eq, inArray } from 'drizzle-orm'

import { db } from '#/db/index'
import { deletePendingOutboxRowsForUser } from '#/lib/email-outbox.server'
import {
  account,
  auditLog,
  cart,
  cartItem,
  dispute,
  disputeMessage,
  invoices,
  notification,
  payout,
  payoutReconciliationLog,
  platformOrder,
  product,
  review,
  session,
  shop,
  shopOrder,
  twoFactor,
  user,
  userEmailPreference,
} from '#/db/schema'
import type { SerializableValue } from './notifications.server'
const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.eurtisan.invalid'

export interface UserDataExport {
  exportedAt: string
  profile: {
    id: string
    name: string
    email: string
    role: string
    emailVerified: boolean
    createdAt: string
    updatedAt: string
  }
  shops: Array<{
    id: string
    name: string
    slug: string
    status: string
    createdAt: string
  }>
  orders: Array<{
    id: string
    status: string
    totalCents: number
    createdAt: string
    shippingAddress: SerializableValue
    billingAddress: SerializableValue
  }>
  reviews: Array<{
    id: string
    productId: string
    rating: number
    comment: string | null
    createdAt: string
  }>
  disputes: Array<{
    id: string
    shopOrderId: string
    reason: string
    description: string
    status: string
    createdAt: string
  }>
  notifications: Array<{
    id: string
    type: string
    data: SerializableValue
    readAt: string | null
    createdAt: string
  }>
}

export async function exportUserData(userId: string): Promise<UserDataExport> {
  const [profile] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!profile || profile.deletedAt) {
    throw new Error('USER_NOT_FOUND')
  }

  const [shops, orders, reviews, disputes, notifications] = await Promise.all([
    db.select().from(shop).where(eq(shop.ownerId, userId)),
    db.select().from(platformOrder).where(eq(platformOrder.userId, userId)),
    db.select().from(review).where(eq(review.buyerUserId, userId)),
    db.select().from(dispute).where(eq(dispute.buyerUserId, userId)),
    db.select().from(notification).where(eq(notification.userId, userId)),
  ])

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      emailVerified: profile.emailVerified,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    shops: shops.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
      shippingAddress: o.shippingAddress as SerializableValue,
      billingAddress: o.billingAddress as SerializableValue,
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      productId: r.productId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
    disputes: disputes.map((d) => ({
      id: d.id,
      shopOrderId: d.shopOrderId,
      reason: d.reason,
      description: d.description,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data as SerializableValue,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  }
}

function redactedAddress(): Record<string, string> {
  return {
    name: 'Deleted User',
    street: '[redacted]',
    city: '[redacted]',
    postalCode: '[redacted]',
    country: 'XX',
  }
}

const PAYOUT_PAYLOAD_PII_KEYS = new Set([
  'buyerName',
  'buyerEmail',
  'address',
  'shippingAddress',
  'billingAddress',
  'name',
  'email',
])

function redactPayoutPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') {
    return payload
  }

  if (Array.isArray(payload)) {
    return payload.map(redactPayoutPayload)
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (PAYOUT_PAYLOAD_PII_KEYS.has(key)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = redactedAddress()
      } else {
        result[key] = '[redacted]'
      }
    } else if (typeof value === 'object') {
      result[key] = redactPayoutPayload(value)
    } else {
      result[key] = value
    }
  }
  return result
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const [profile] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!profile || profile.deletedAt) {
    throw new Error('USER_NOT_FOUND')
  }

  if (profile.role === 'admin') {
    throw new Error('ADMIN_DELETE_FORBIDDEN')
  }

  const ownedShops = await db
    .select({ id: shop.id, status: shop.status })
    .from(shop)
    .where(eq(shop.ownerId, userId))

  const ownedShopIds = ownedShops.map((s) => s.id)
  const anonymizedEmail = `deleted-${userId}@${ANONYMIZED_EMAIL_DOMAIN}`
  const redacted = redactedAddress()

  await db.transaction(async (tx) => {
    if (ownedShopIds.length > 0) {
      await tx
        .update(shop)
        .set({
          status: 'archived',
          archivedAt: new Date(),
          scheduledDeleteAt: null,
          businessAddress: redacted,
          shippingOrigin: redacted,
          updatedAt: new Date(),
        })
        .where(inArray(shop.id, ownedShopIds))

      await tx
        .update(product)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(product.shopId, ownedShopIds))
    }

    const userOrders = await tx
      .select({ id: platformOrder.id })
      .from(platformOrder)
      .where(eq(platformOrder.userId, userId))

    for (const order of userOrders) {
      await tx
        .update(platformOrder)
        .set({
          shippingAddress: redacted,
          billingAddress: redacted,
          updatedAt: new Date(),
        })
        .where(eq(platformOrder.id, order.id))
    }

    await tx.update(review).set({ comment: null }).where(eq(review.buyerUserId, userId))

    const userDisputeIds = await tx
      .select({ id: dispute.id })
      .from(dispute)
      .where(eq(dispute.buyerUserId, userId))

    if (userDisputeIds.length > 0) {
      await tx
        .update(dispute)
        .set({ description: '[redacted — account deleted]', updatedAt: new Date() })
        .where(eq(dispute.buyerUserId, userId))
    }

    await tx.delete(notification).where(eq(notification.userId, userId))

    const userCarts = await tx.select({ id: cart.id }).from(cart).where(eq(cart.userId, userId))
    if (userCarts.length > 0) {
      const cartIds = userCarts.map((c) => c.id)
      await tx.delete(cartItem).where(inArray(cartItem.cartId, cartIds))
      await tx.delete(cart).where(inArray(cart.id, cartIds))
    }

    await tx
      .update(disputeMessage)
      .set({ message: '[message removed — account deleted]' })
      .where(eq(disputeMessage.senderUserId, userId))

    const ownedShopInvoiceIds = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
      .where(inArray(shopOrder.shopId, ownedShopIds))

    for (const invoice of ownedShopInvoiceIds) {
      await tx.update(invoices).set({ billingDetails: redacted }).where(eq(invoices.id, invoice.id))
    }

    const ownedPayoutLogRows = await tx
      .select({ id: payoutReconciliationLog.id, payload: payoutReconciliationLog.payload })
      .from(payoutReconciliationLog)
      .innerJoin(payout, eq(payoutReconciliationLog.payoutId, payout.id))
      .where(inArray(payout.shopId, ownedShopIds))

    for (const logRow of ownedPayoutLogRows) {
      await tx
        .update(payoutReconciliationLog)
        .set({ payload: redactPayoutPayload(logRow.payload) })
        .where(eq(payoutReconciliationLog.id, logRow.id))
    }

    await tx.update(auditLog).set({ actorName: 'Deleted User' }).where(eq(auditLog.actorId, userId))

    await tx.delete(session).where(eq(session.userId, userId))
    await tx.delete(account).where(eq(account.userId, userId))
    await tx.delete(twoFactor).where(eq(twoFactor.userId, userId))
    await tx.delete(userEmailPreference).where(eq(userEmailPreference.userId, userId))

    // Delete pending emails before anonymizing the address. The CASCADE on
    // userId would remove them after the update, but explicit deletion is
    // safer and avoids sending to an anonymized address.
    await deletePendingOutboxRowsForUser(userId, tx)

    await tx
      .update(user)
      .set({
        name: 'Deleted User',
        email: anonymizedEmail,
        image: null,
        emailVerified: false,
        twoFactorEnabled: false,
        unsubscribeToken: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
  })
}
