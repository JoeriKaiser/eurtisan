import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import { dispute, disputeMessage, platformOrder, shop, shopOrder, user } from '#/db/schema'
import type { OrderStatus } from './orders.server'
import { recalcPlatformOrderStatus } from './shop-orders.server'

const DISPUTE_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface DisputeParticipant {
  id: string
  name: string
}

export interface DisputeMessageItem {
  id: string
  senderUserId: string
  senderName: string
  message: string
  createdAt: Date
}

export interface DisputeOrderInfo {
  id: string
  shopId: string
  shopName: string
  status: string
  subtotalCents: number
  shippingCostCents: number
  totalCents: number
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
  shopId: string
  shopName: string
  reason: string
  status: string
  createdAt: Date
  orderTotalCents: number
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

  if (shopOrderRecord.status !== 'delivered') {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Order must be delivered before opening a dispute',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
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

  return db.transaction(async (tx) => {
    let created: typeof dispute.$inferSelect
    try {
      const result = await tx
        .insert(dispute)
        .values({
          shopOrderId: input.shopOrderId,
          buyerUserId,
          reason: input.reason,
          description: input.description,
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
      message: sanitizeMessage(message),
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

export async function listOpenDisputesQuery(): Promise<DisputeListItem[]> {
  const rows = await db
    .select({
      id: dispute.id,
      shopOrderId: dispute.shopOrderId,
      buyerUserId: dispute.buyerUserId,
      buyerName: user.name,
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
    .where(eq(dispute.status, 'open'))
    .orderBy(asc(dispute.createdAt))

  return rows.map((row) => ({
    id: row.id,
    shopOrderId: row.shopOrderId,
    buyerUserId: row.buyerUserId,
    buyerName: row.buyerName,
    shopId: row.shopId,
    shopName: row.shopName,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
    orderTotalCents: row.subtotalCents + row.shippingCostCents,
  }))
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
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, disputeRecord.buyerUserId))
    .limit(1)

  const [ownerRecord] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, shopRecord?.ownerId ?? ''))
    .limit(1)

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
    buyer: buyerRecord ?? { id: disputeRecord.buyerUserId, name: 'Unknown' },
    shop: ownerRecord ?? { id: shopRecord?.ownerId ?? '', name: 'Unknown' },
    order: {
      id: shopOrderRecord.id,
      shopId: shopOrderRecord.shopId,
      shopName: shopRecord?.name ?? 'Unknown shop',
      status: shopOrderRecord.status,
      subtotalCents: shopOrderRecord.subtotalCents,
      shippingCostCents: shopOrderRecord.shippingCostCents,
      totalCents: shopOrderRecord.subtotalCents + shopOrderRecord.shippingCostCents,
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

  return db.transaction(async (tx) => {
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

    return {
      id: updated.id,
      status: updated.status,
      resolution: updated.resolution ?? '',
      refundCents: updated.refundCents,
      updatedAt: updated.updatedAt,
    }
  })
}

function sanitizeMessage(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}
