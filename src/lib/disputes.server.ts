import { asc, count, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import z from 'zod'
import { db } from '#/db/index'
import {
  dispute,
  disputeMessage,
  orderItem,
  platformOrder,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import { getBaseUrl } from './env.server'
import { sanitizeRichText, validatePlainText } from './xss'
import { logOrderDisputed, logOrderResolved } from './order-logger'
import type { OrderStatus } from './orders.server'
import { recalcPlatformOrderStatus } from './shop-orders.server'

const creatorUser = alias(user, 'creator')

const DISPUTE_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface DisputeParticipant {
  id: string
  name: string
  email: string
}

export interface DisputeMessageItem {
  id: string
  senderUserId: string
  senderName: string
  message: string
  createdAt: Date
}

export interface DisputeOrderItem {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
}

export interface DisputeOrderInfo {
  id: string
  platformOrderId: string
  shopId: string
  shopName: string
  status: string
  subtotalCents: number
  shippingCostCents: number
  totalCents: number
  createdAt: Date
  items: DisputeOrderItem[]
}

export interface DisputeDetail {
  id: string
  shopOrderId: string
  buyerUserId: string
  reason: string
  description: string
  status: string
  resolution: string | null
  refundCents: number | null
  createdAt: Date
  updatedAt: Date
  buyer: DisputeParticipant
  shop: DisputeParticipant
  order: DisputeOrderInfo
  messages: DisputeMessageItem[]
}

export interface DisputeListItem {
  id: string
  shopOrderId: string
  buyerUserId: string
  buyerName: string
  creatorName: string
  shopId: string
  shopName: string
  reason: string
  status: string
  createdAt: Date
  orderTotalCents: number
}

export interface PaginatedDisputes {
  disputes: DisputeListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CreatedDispute {
  id: string
  shopOrderId: string
  buyerUserId: string
  reason: string
  description: string
  status: string
  createdAt: Date
}

export interface CreatedDisputeMessage {
  id: string
  disputeId: string
  senderUserId: string
  message: string
  createdAt: Date
}

export interface ResolveDisputeInput {
  resolution: 'close' | 'partial_refund' | 'full_refund'
  refundCents?: number | null
}

export interface ResolvedDispute {
  id: string
  status: string
  resolution: string
  refundCents: number | null
  updatedAt: Date
}

export const openDisputeSchema = z.object({
  shopOrderId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
})

export const addDisputeMessageSchema = z.object({
  disputeId: z.string().uuid(),
  message: z.string().min(1).max(5000),
})

export const resolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  resolution: z.enum(['close', 'partial_refund', 'full_refund']),
  refundCents: z.number().int().min(0).optional().nullable(),
})

export async function openDisputeQuery(
  input: z.infer<typeof openDisputeSchema>,
  buyerUserId: string,
): Promise<CreatedDispute> {
  const [shopOrderRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, input.shopOrderId))
    .limit(1)

  if (!shopOrderRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [platformOrderRecord] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, shopOrderRecord.platformOrderId))
    .limit(1)

  if (!platformOrderRecord || platformOrderRecord.userId !== buyerUserId) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const existingDispute = await db
    .select()
    .from(dispute)
    .where(eq(dispute.shopOrderId, input.shopOrderId))
    .limit(1)

  if (existingDispute.length > 0) {
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'A dispute already exists for this order' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (shopOrderRecord.status !== 'delivered') {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Order must be delivered before opening a dispute',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!shopOrderRecord.deliveredAt) {
    throw new Response(
      JSON.stringify({ error: 'Bad Request', message: 'Order delivery date is missing' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const daysSinceDelivery = (Date.now() - shopOrderRecord.deliveredAt.getTime()) / MS_PER_DAY
  if (daysSinceDelivery > DISPUTE_WINDOW_DAYS) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'Dispute window has expired (30 days)' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const result = await db.transaction(async (tx) => {
    let created: typeof dispute.$inferSelect
    try {
      const result = await tx
        .insert(dispute)
        .values({
          shopOrderId: input.shopOrderId,
          buyerUserId,
          reason: validatePlainText(input.reason, 'Dispute reason'),
          description: sanitizeRichText(input.description) ?? '',
        })
        .returning()
      created = result[0]
    } catch (err) {
      // Unique constraint violation (23505) — duplicate dispute race condition
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        throw new Response(
          JSON.stringify({ error: 'Conflict', message: 'A dispute already exists for this order' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw err
    }

    await tx
      .update(shopOrder)
      .set({ status: 'disputed', updatedAt: new Date() })
      .where(eq(shopOrder.id, input.shopOrderId))

    await recalcPlatformOrderStatus(tx, shopOrderRecord.platformOrderId)

    try {
      const { createNotification } = await import('./notifications.server')
      await createNotification(buyerUserId, 'dispute_opened', {
        platformOrderId: shopOrderRecord.platformOrderId,
        shopOrderId: input.shopOrderId,
      })
    } catch {
      // Notification errors must not break the primary business transaction
    }

    logOrderDisputed({
      disputeId: created.id,
      shopOrderId: created.shopOrderId,
      platformOrderId: shopOrderRecord.platformOrderId,
      reason: created.reason,
    })

    return {
      id: created.id,
      shopOrderId: created.shopOrderId,
      buyerUserId: created.buyerUserId,
      reason: created.reason,
      description: created.description,
      status: created.status,
      createdAt: created.createdAt,
    }
  })

  // Send dispute update email after the transaction
  try {
    const { sendNotificationEmail } = await import('./notifications.server')
    const [buyerRecord] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, buyerUserId))
      .limit(1)
    const [shopRecord] = await db
      .select()
      .from(shop)
      .where(eq(shop.id, shopOrderRecord.shopId))
      .limit(1)

    await sendNotificationEmail(buyerUserId, 'dispute_update', {
      orderNumber: input.shopOrderId.slice(0, 8),
      buyerName: buyerRecord?.name,
      shopName: shopRecord?.name ?? 'Eurtisan',
      status: 'opened',
      message: input.reason,
      disputeUrl: `${getBaseUrl()}/disputes/${result.id}`,
    })
  } catch {
    // Email errors must not break the primary business flow
  }

  return result
}

export async function addDisputeMessageQuery(
  disputeId: string,
  message: string,
  senderUserId: string,
  senderRole: string,
): Promise<CreatedDisputeMessage> {
  const [disputeRecord] = await db.select().from(dispute).where(eq(dispute.id, disputeId)).limit(1)

  if (!disputeRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Dispute not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [shopOrderRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, disputeRecord.shopOrderId))
    .limit(1)

  const isBuyer = disputeRecord.buyerUserId === senderUserId

  let isOwner = false
  if (shopOrderRecord) {
    const [shopRecord] = await db
      .select()
      .from(shop)
      .where(eq(shop.id, shopOrderRecord.shopId))
      .limit(1)
    isOwner = shopRecord?.ownerId === senderUserId
  }

  const isAdmin = senderRole === 'admin'

  if (!isBuyer && !isOwner && !isAdmin) {
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'You do not have permission to post in this dispute',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [created] = await db
    .insert(disputeMessage)
    .values({
      disputeId,
      senderUserId,
      message: sanitizeRichText(message) ?? '',
    })
    .returning()

  return {
    id: created.id,
    disputeId: created.disputeId,
    senderUserId: created.senderUserId,
    message: created.message,
    createdAt: created.createdAt,
  }
}

export async function listOpenDisputesQuery(params: {
  page: number
  pageSize: number
}): Promise<PaginatedDisputes> {
  const { page, pageSize } = params
  const offset = (page - 1) * pageSize

  const baseQuery = db
    .select({
      id: dispute.id,
      shopOrderId: dispute.shopOrderId,
      buyerUserId: dispute.buyerUserId,
      buyerName: user.name,
      creatorName: creatorUser.name,
      shopId: shopOrder.shopId,
      shopName: shop.name,
      reason: dispute.reason,
      status: dispute.status,
      createdAt: dispute.createdAt,
      subtotalCents: shopOrder.subtotalCents,
      shippingCostCents: shopOrder.shippingCostCents,
    })
    .from(dispute)
    .innerJoin(shopOrder, eq(dispute.shopOrderId, shopOrder.id))
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(dispute.buyerUserId, user.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .leftJoin(creatorUser, eq(shop.ownerId, creatorUser.id))
    .where(eq(dispute.status, 'open'))

  const [rows, totalResult] = await Promise.all([
    baseQuery.orderBy(asc(dispute.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(dispute).where(eq(dispute.status, 'open')),
  ])

  return {
    disputes: rows.map((row) => ({
      id: row.id,
      shopOrderId: row.shopOrderId,
      buyerUserId: row.buyerUserId,
      buyerName: row.buyerName,
      creatorName: row.creatorName ?? 'Unknown',
      shopId: row.shopId,
      shopName: row.shopName,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
      orderTotalCents: row.subtotalCents + row.shippingCostCents,
    })),
    total: Number(totalResult[0]?.count ?? 0),
    page,
    pageSize,
  }
}

export async function getDisputeDetailQuery(
  disputeId: string,
  callerUserId: string,
  callerRole: string,
): Promise<DisputeDetail | null> {
  const [disputeRecord] = await db.select().from(dispute).where(eq(dispute.id, disputeId)).limit(1)

  if (!disputeRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Dispute not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [shopOrderRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, disputeRecord.shopOrderId))
    .limit(1)

  if (!shopOrderRecord) {
    return null
  }

  const isAdmin = callerRole === 'admin'
  const isBuyer = disputeRecord.buyerUserId === callerUserId

  const [shopRecord] = await db
    .select()
    .from(shop)
    .where(eq(shop.id, shopOrderRecord.shopId))
    .limit(1)

  let isOwner = false
  if (shopRecord) {
    isOwner = shopRecord.ownerId === callerUserId
  }

  if (!isAdmin && !isBuyer && !isOwner) {
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'You do not have permission to view this dispute',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const messagesResult = await db
    .select({
      id: disputeMessage.id,
      senderUserId: disputeMessage.senderUserId,
      senderName: user.name,
      message: disputeMessage.message,
      createdAt: disputeMessage.createdAt,
    })
    .from(disputeMessage)
    .innerJoin(user, eq(disputeMessage.senderUserId, user.id))
    .where(eq(disputeMessage.disputeId, disputeId))
    .orderBy(asc(disputeMessage.createdAt))

  const [buyerRecord] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, disputeRecord.buyerUserId))
    .limit(1)

  const [ownerRecord] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, shopRecord?.ownerId ?? ''))
    .limit(1)

  const orderItems = await db
    .select({
      id: orderItem.id,
      productId: orderItem.productId,
      productName: orderItem.productName,
      unitPriceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
      totalCents: orderItem.totalCents,
    })
    .from(orderItem)
    .where(eq(orderItem.shopOrderId, disputeRecord.shopOrderId))
    .orderBy(orderItem.productName)

  return {
    id: disputeRecord.id,
    shopOrderId: disputeRecord.shopOrderId,
    buyerUserId: disputeRecord.buyerUserId,
    reason: disputeRecord.reason,
    description: disputeRecord.description,
    status: disputeRecord.status,
    resolution: disputeRecord.resolution,
    refundCents: disputeRecord.refundCents,
    createdAt: disputeRecord.createdAt,
    updatedAt: disputeRecord.updatedAt,
    buyer: buyerRecord ?? { id: disputeRecord.buyerUserId, name: 'Unknown', email: '' },
    shop: ownerRecord ?? { id: shopRecord?.ownerId ?? '', name: 'Unknown', email: '' },
    order: {
      id: shopOrderRecord.id,
      platformOrderId: shopOrderRecord.platformOrderId,
      shopId: shopOrderRecord.shopId,
      shopName: shopRecord?.name ?? 'Unknown shop',
      status: shopOrderRecord.status,
      subtotalCents: shopOrderRecord.subtotalCents,
      shippingCostCents: shopOrderRecord.shippingCostCents,
      totalCents: shopOrderRecord.subtotalCents + shopOrderRecord.shippingCostCents,
      createdAt: shopOrderRecord.createdAt,
      items: orderItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
      })),
    },
    messages: messagesResult.map((m) => ({
      id: m.id,
      senderUserId: m.senderUserId,
      senderName: m.senderName,
      message: m.message,
      createdAt: m.createdAt,
    })),
  }
}

export async function resolveDisputeQuery(
  disputeId: string,
  input: ResolveDisputeInput,
): Promise<ResolvedDispute> {
  const [disputeRecord] = await db.select().from(dispute).where(eq(dispute.id, disputeId)).limit(1)

  if (!disputeRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Dispute not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (disputeRecord.status !== 'open') {
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'Dispute has already been resolved' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [shopOrderRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, disputeRecord.shopOrderId))
    .limit(1)

  if (!shopOrderRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch the Mollie payment ID for potential refund
  const [platformOrderRecord] = await db
    .select({ molliePaymentId: platformOrder.molliePaymentId })
    .from(platformOrder)
    .where(eq(platformOrder.id, shopOrderRecord.platformOrderId))
    .limit(1)

  const molliePaymentId = platformOrderRecord?.molliePaymentId ?? null

  const orderTotalCents = shopOrderRecord.subtotalCents + shopOrderRecord.shippingCostCents

  let refundCents: number | null = null

  if (input.resolution === 'close') {
    refundCents = null
  } else if (input.resolution === 'full_refund') {
    refundCents = orderTotalCents
  } else if (input.resolution === 'partial_refund') {
    if (input.refundCents === undefined || input.refundCents === null) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Refund amount is required for partial refund',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (input.refundCents <= 0) {
      throw new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Refund amount must be greater than 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (input.refundCents > orderTotalCents) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Refund amount cannot exceed order total of ${orderTotalCents} cents`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    refundCents = input.refundCents
  }

  const newOrderStatus: OrderStatus = input.resolution === 'close' ? 'completed' : 'refunded'

  const [shopRecord] = await db
    .select({ ownerId: shop.ownerId })
    .from(shop)
    .where(eq(shop.id, shopOrderRecord.shopId))
    .limit(1)

  const creatorUserId = shopRecord?.ownerId ?? null

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(dispute)
      .set({
        status: 'resolved',
        resolution: input.resolution,
        refundCents,
        updatedAt: new Date(),
      })
      .where(eq(dispute.id, disputeId))
      .returning()

    await tx
      .update(shopOrder)
      .set({ status: newOrderStatus, updatedAt: new Date() })
      .where(eq(shopOrder.id, disputeRecord.shopOrderId))

    await recalcPlatformOrderStatus(tx, shopOrderRecord.platformOrderId)

    const notificationData = {
      disputeId,
      shopOrderId: disputeRecord.shopOrderId,
      platformOrderId: shopOrderRecord.platformOrderId,
      resolution: input.resolution,
      refundCents,
    }

    // Notify buyer
    try {
      const { createNotification } = await import('./notifications.server')
      await createNotification(disputeRecord.buyerUserId, 'dispute_resolved', notificationData)
    } catch {
      // Notification errors must not break the primary business transaction
    }

    // Notify creator (shop owner)
    if (creatorUserId) {
      try {
        const { createNotification } = await import('./notifications.server')
        await createNotification(creatorUserId, 'dispute_resolved', notificationData)
      } catch {
        // Notification errors must not break the primary business transaction
      }
    }

    return {
      id: updated.id,
      status: updated.status,
      resolution: updated.resolution ?? '',
      refundCents: updated.refundCents,
      updatedAt: updated.updatedAt,
    }
  })

  logOrderResolved({
    disputeId,
    shopOrderId: disputeRecord.shopOrderId,
    platformOrderId: shopOrderRecord.platformOrderId,
    resolution: input.resolution,
    refundCents,
  })

  // Send dispute update emails after the transaction
  try {
    const { sendNotificationEmail } = await import('./notifications.server')
    const [buyerRecord] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, disputeRecord.buyerUserId))
      .limit(1)
    const [sellerRecord] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, creatorUserId ?? ''))
      .limit(1)
    const [shopRecord] = await db
      .select()
      .from(shop)
      .where(eq(shop.id, shopOrderRecord.shopId))
      .limit(1)

    const baseUrl = getBaseUrl()
    const message =
      input.resolution === 'close'
        ? 'The dispute has been closed.'
        : input.resolution === 'full_refund'
          ? 'A full refund has been issued.'
          : input.resolution === 'partial_refund'
            ? `A partial refund has been issued.`
            : 'The dispute has been resolved.'

    await sendNotificationEmail(disputeRecord.buyerUserId, 'dispute_update', {
      orderNumber: disputeRecord.shopOrderId.slice(0, 8),
      buyerName: buyerRecord?.name,
      shopName: shopRecord?.name ?? 'Eurtisan',
      status: input.resolution,
      message,
      disputeUrl: `${baseUrl}/disputes/${disputeId}`,
    })

    if (creatorUserId) {
      await sendNotificationEmail(creatorUserId, 'dispute_update', {
        orderNumber: disputeRecord.shopOrderId.slice(0, 8),
        buyerName: sellerRecord?.name,
        shopName: shopRecord?.name ?? 'Eurtisan',
        status: input.resolution,
        message,
        disputeUrl: `${baseUrl}/disputes/${disputeId}`,
      })
    }
  } catch {
    // Email errors must not break the primary business flow
  }

  // 2. Process refund through Mollie (outside the transaction — external API call).
  //    Refund failures are logged but must not undo the dispute resolution.
  if (refundCents !== null && refundCents > 0 && molliePaymentId) {
    try {
      await molliePaymentProvider.refundPayment(molliePaymentId, refundCents)
    } catch {
      // Refund API call failed but the dispute has been resolved internally.
      // In production this should trigger an alert for manual intervention.
      console.error(
        `Mollie refund failed for payment ${molliePaymentId}, dispute ${disputeId}, amount ${refundCents} cents`,
      )
    }
  }

  return result
}
