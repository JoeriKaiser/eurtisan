import '@tanstack/react-start/server-only'

import { randomBytes } from 'node:crypto'
import { getCookie, getRequestProtocol, setCookie } from '@tanstack/react-start/server'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  dispute,
  guestOrderAccess,
  platformOrder,
  returnRequest,
  review,
  shopOrder,
  user,
} from '#/db/schema'
import { decrypt, decryptJsonb, encrypt } from '../encryption.server'
import { enqueueEmail } from '../email-outbox.server'
import { sha256Hex } from '../hash.server'

export const GUEST_ORDER_ACCESS_COOKIE = '__Host-eurtisan-guest-order'
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000

function createToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function issueGuestOrderAccess(input: {
  platformOrderId: string
  orderNumber: string
  email: string
  buyerName: string
}): Promise<void> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const [token, emailHash] = await Promise.all([
    Promise.resolve(createToken()),
    sha256Hex(normalizedEmail),
  ])
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS)

  await db
    .insert(guestOrderAccess)
    .values({
      platformOrderId: input.platformOrderId,
      emailHash,
      tokenHash,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: guestOrderAccess.platformOrderId,
      set: { tokenHash, emailHash, expiresAt, consumedAt: null, createdAt: new Date() },
    })

  await enqueueEmail({
    to: normalizedEmail,
    userId: null,
    template: 'guest_order_access',
    data: {
      buyerName: input.buyerName,
      orderNumber: input.orderNumber,
      encryptedAccessToken: encrypt(token),
    },
    category: 'transactional',
    idempotencyKey: `guest-order:${input.platformOrderId}:access:${tokenHash.slice(0, 16)}`,
  })
}

export async function claimGuestOrdersForVerifiedUser(input: {
  userId: string
  email: string
}): Promise<number> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const [account] = await db
    .select({ email: user.email, emailVerified: user.emailVerified, isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1)
  if (
    !account?.emailVerified ||
    account.isAnonymous ||
    account.email.trim().toLowerCase() !== normalizedEmail
  ) {
    return 0
  }
  const emailHash = await sha256Hex(normalizedEmail)
  return db.transaction(async (tx) => {
    const orders = await tx
      .select({ id: platformOrder.id, anonymousUserId: platformOrder.userId })
      .from(platformOrder)
      .where(and(eq(platformOrder.buyerEmailHash, emailHash), eq(platformOrder.isGuest, true)))
      .for('update')
    if (orders.length === 0) return 0

    const orderIds = orders.map((order) => order.id)
    await tx
      .update(platformOrder)
      .set({ userId: input.userId, isGuest: false, updatedAt: new Date() })
      .where(inArray(platformOrder.id, orderIds))
    const returnIds = await tx
      .select({ id: returnRequest.id })
      .from(returnRequest)
      .innerJoin(shopOrder, eq(returnRequest.shopOrderId, shopOrder.id))
      .where(inArray(shopOrder.platformOrderId, orderIds))
    if (returnIds.length > 0) {
      await tx
        .update(returnRequest)
        .set({ buyerUserId: input.userId, updatedAt: new Date() })
        .where(
          inArray(
            returnRequest.id,
            returnIds.map((request) => request.id),
          ),
        )
    }
    const disputeIds = await tx
      .select({ id: dispute.id })
      .from(dispute)
      .innerJoin(shopOrder, eq(dispute.shopOrderId, shopOrder.id))
      .where(inArray(shopOrder.platformOrderId, orderIds))
    if (disputeIds.length > 0) {
      await tx
        .update(dispute)
        .set({ buyerUserId: input.userId, updatedAt: new Date() })
        .where(
          inArray(
            dispute.id,
            disputeIds.map((record) => record.id),
          ),
        )
    }
    const reviewIds = await tx
      .select({ id: review.id })
      .from(review)
      .innerJoin(shopOrder, eq(review.shopOrderId, shopOrder.id))
      .where(inArray(shopOrder.platformOrderId, orderIds))
    if (reviewIds.length > 0) {
      await tx
        .update(review)
        .set({ buyerUserId: input.userId })
        .where(
          inArray(
            review.id,
            reviewIds.map((record) => record.id),
          ),
        )
    }
    await tx.delete(guestOrderAccess).where(inArray(guestOrderAccess.platformOrderId, orderIds))
    return orders.length
  })
}

export async function requestGuestOrderAccessEmail(input: {
  orderNumber: string
  email: string
}): Promise<void> {
  const emailHash = await sha256Hex(input.email.trim().toLowerCase())
  const [order] = await db
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      buyerEmail: platformOrder.buyerEmail,
      shippingAddress: platformOrder.shippingAddress,
    })
    .from(platformOrder)
    .where(
      and(
        eq(platformOrder.orderNumber, input.orderNumber.trim()),
        eq(platformOrder.buyerEmailHash, emailHash),
        eq(platformOrder.isGuest, true),
      ),
    )
    .limit(1)
  if (!order?.buyerEmail) return
  const address = decryptJsonb<{ name?: string }>(order.shippingAddress)
  await issueGuestOrderAccess({
    platformOrderId: order.id,
    orderNumber: order.orderNumber,
    email: decrypt(order.buyerEmail),
    buyerName: address?.name ?? 'Guest buyer',
  })
}

export async function exchangeGuestOrderAccessToken(token: string): Promise<string> {
  const tokenHash = await sha256Hex(token)
  const [access] = await db
    .select({
      platformOrderId: guestOrderAccess.platformOrderId,
      expiresAt: guestOrderAccess.expiresAt,
    })
    .from(guestOrderAccess)
    .where(
      and(eq(guestOrderAccess.tokenHash, tokenHash), gt(guestOrderAccess.expiresAt, new Date())),
    )
    .limit(1)

  if (!access) {
    throw new Response(JSON.stringify({ error: 'Gone', code: 'GUEST_ACCESS_INVALID' }), {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  setCookie(GUEST_ORDER_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: getRequestProtocol() === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(1, Math.floor((access.expiresAt.getTime() - Date.now()) / 1000)),
  })

  return access.platformOrderId
}

export async function hasGuestOrderAccess(platformOrderId: string): Promise<boolean> {
  const token = getCookie(GUEST_ORDER_ACCESS_COOKIE)
  if (!token) return false
  const tokenHash = await sha256Hex(token)
  const [access] = await db
    .select({ id: guestOrderAccess.id })
    .from(guestOrderAccess)
    .where(
      and(
        eq(guestOrderAccess.platformOrderId, platformOrderId),
        eq(guestOrderAccess.tokenHash, tokenHash),
        gt(guestOrderAccess.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return !!access
}

export async function canAccessOrder(
  platformOrderId: string,
  userId?: string | null,
): Promise<boolean> {
  if (userId) {
    const [order] = await db
      .select({
        userId: platformOrder.userId,
        isGuest: platformOrder.isGuest,
        ownerIsAnonymous: user.isAnonymous,
      })
      .from(platformOrder)
      .innerJoin(user, eq(platformOrder.userId, user.id))
      .where(eq(platformOrder.id, platformOrderId))
      .limit(1)
    if (order?.userId === userId && (!order.isGuest || order.ownerIsAnonymous)) return true
  }
  return hasGuestOrderAccess(platformOrderId)
}
