import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type z from 'zod'
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
import { DISPUTE_WINDOW_DAYS } from '../constants'
import { getBaseUrl } from '../env.server'
import { logger } from '../logger.server'
import { logOrderDisputed, logOrderResolved } from '../order-logger'
import type { OrderStatus } from '../order-status'
import { recalcPlatformOrderStatus } from '../shop-orders.server'
import { restoreShopOrderStockInTx } from '../inventory.server'
import { createCreditNoteForShopOrder } from '../invoices.server'
import { reversePayoutForRefund } from '../payouts.server'
import { sanitizeRichText, validatePlainText } from '../xss'
import type { openDisputeSchema } from './schemas'
import type {
  CreatedDispute,
  CreatedDisputeMessage,
  DisputeDetail,
  PaginatedDisputes,
  ResolvedDispute,
  ResolveDisputeInput,
} from './types'
import type { DisputeStatus } from './lifecycle'
import { isValidDisputeTransition } from './lifecycle'

const creatorUser = alias(user, 'creator')

const MS_PER_DAY = 24 * 60 * 60 * 1000

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
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      userId: platformOrder.userId,
    })
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
      JSON.stringify({
        error: 'Forbidden',
        message: 'Dispute window has expired (30 days)',
        code: 'DISPUTE_WINDOW_EXPIRED',
      }),
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
      const { createNotification } = await import('../notifications.server')
      await createNotification(buyerUserId, 'dispute_opened', {
        platformOrderId: shopOrderRecord.platformOrderId,
        orderNumber: platformOrderRecord.orderNumber,
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
    const [{ sendNotificationEmail }, [buyerRecord], [shopRecord]] = await Promise.all([
      import('../notifications.server'),
      db.select({ name: user.name }).from(user).where(eq(user.id, buyerUserId)).limit(1),
      db.select().from(shop).where(eq(shop.id, shopOrderRecord.shopId)).limit(1),
    ])

    await sendNotificationEmail({
      userId: buyerUserId,
      template: 'dispute_update',
      data: {
        orderNumber: platformOrderRecord.orderNumber,
        buyerName: buyerRecord?.name,
        shopName: shopRecord?.name ?? 'Eurtisan',
        status: 'opened',
        message: input.reason,
        disputeUrl: `${getBaseUrl()}/disputes/${result.id}`,
      },
      idempotencyKey: `dispute:${result.id}:opened`,
      category: 'transactional',
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

  const sanitizedMessage = (sanitizeRichText(message) ?? '').trim()
  if (!sanitizedMessage) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Message cannot be empty.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [created] = await db
    .insert(disputeMessage)
    .values({
      disputeId,
      senderUserId,
      message: sanitizedMessage,
    })
    .returning()

  const [sender] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, created.senderUserId))
    .limit(1)

  return {
    id: created.id,
    disputeId: created.disputeId,
    senderUserId: created.senderUserId,
    senderName: sender?.name ?? 'Unknown',
    message: created.message,
    createdAt: created.createdAt,
  }
}

export async function listOpenDisputesQuery(params: {
  page: number
  pageSize: number
  status?: 'all' | 'open' | 'resolved'
  query?: string
}): Promise<PaginatedDisputes> {
  const { page, pageSize, status: statusFilter = 'open', query } = params
  const offset = (page - 1) * pageSize

  const conditions = []
  if (statusFilter !== 'all') {
    conditions.push(eq(dispute.status, statusFilter))
  }

  if (query) {
    const pattern = `%${query}%`
    conditions.push(
      or(
        ilike(user.name, pattern),
        ilike(creatorUser.name, pattern),
        ilike(sql`${dispute.shopOrderId}::text`, pattern),
      ),
    )
  }

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
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  const countWhere = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalResult] = await Promise.all([
    baseQuery.orderBy(asc(dispute.createdAt)).limit(pageSize).offset(offset),
    db
      .select({ count: count() })
      .from(dispute)
      .innerJoin(shopOrder, eq(dispute.shopOrderId, shopOrder.id))
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .innerJoin(user, eq(dispute.buyerUserId, user.id))
      .innerJoin(shop, eq(shopOrder.shopId, shop.id))
      .leftJoin(creatorUser, eq(shop.ownerId, creatorUser.id))
      .where(countWhere),
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
    .select({
      shopOrder,
      platformOrderNumber: platformOrder.orderNumber,
    })
    .from(shopOrder)
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
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
    .where(eq(shop.id, shopOrderRecord.shopOrder.shopId))
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

  const [messagesResult, buyerRecord, ownerRecord, orderItems] = await Promise.all([
    db
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
      .orderBy(asc(disputeMessage.createdAt)),
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, disputeRecord.buyerUserId))
      .limit(1),
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, shopRecord?.ownerId ?? ''))
      .limit(1),
    db
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
      .orderBy(orderItem.productName),
  ])

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
    buyer: buyerRecord[0] ?? { id: disputeRecord.buyerUserId, name: 'Unknown', email: '' },
    shop: ownerRecord[0] ?? { id: shopRecord?.ownerId ?? '', name: 'Unknown', email: '' },
    order: {
      id: shopOrderRecord.shopOrder.id,
      platformOrderId: shopOrderRecord.shopOrder.platformOrderId,
      platformOrderNumber: shopOrderRecord.platformOrderNumber,
      shopId: shopOrderRecord.shopOrder.shopId,
      shopName: shopRecord?.name ?? 'Unknown shop',
      status: shopOrderRecord.shopOrder.status,
      subtotalCents: shopOrderRecord.shopOrder.subtotalCents,
      shippingCostCents: shopOrderRecord.shopOrder.shippingCostCents,
      totalCents:
        shopOrderRecord.shopOrder.subtotalCents + shopOrderRecord.shopOrder.shippingCostCents,
      createdAt: shopOrderRecord.shopOrder.createdAt,
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
  caller: { userId: string; role: string },
): Promise<ResolvedDispute> {
  if (caller.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Pre-transaction reads to determine refund eligibility and amount
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

  const [platformOrderRecord] = await db
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      molliePaymentId: platformOrder.molliePaymentId,
      totalCents: platformOrder.totalCents,
      refundedCents: platformOrder.refundedCents,
    })
    .from(platformOrder)
    .where(eq(platformOrder.id, shopOrderRecord.platformOrderId))
    .limit(1)

  const molliePaymentId = platformOrderRecord?.molliePaymentId ?? null
  const orderTotalCents = shopOrderRecord.subtotalCents + shopOrderRecord.shippingCostCents

  // Cumulative refund guard: prevent refunding more than the shop order total
  // or the platform order total across multiple disputes.
  const existingShopRefunded = shopOrderRecord.refundedCents ?? 0
  const existingPlatformRefunded = platformOrderRecord?.refundedCents ?? 0

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

  if (refundCents !== null && refundCents > 0) {
    if (existingShopRefunded + refundCents > orderTotalCents) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Cumulative refund would exceed shop order total of ${orderTotalCents} cents`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (
      platformOrderRecord &&
      existingPlatformRefunded + refundCents > platformOrderRecord.totalCents
    ) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Cumulative refund would exceed platform order total of ${platformOrderRecord.totalCents} cents`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const [shopRecord] = await db
    .select({ ownerId: shop.ownerId })
    .from(shop)
    .where(eq(shop.id, shopOrderRecord.shopId))
    .limit(1)

  const creatorUserId = shopRecord?.ownerId ?? null

  // Step 1: record the refund intent, reverse any routed payout, create the
  // credit note, and mark the dispute resolved before contacting Mollie (P0-22).
  const newOrderStatus: OrderStatus = input.resolution === 'close' ? 'completed' : 'refunded'

  const result = await db.transaction(async (tx) => {
    // Acquire row-level lock on the dispute before any status-dependent action
    const [lockedDispute] = await tx
      .select()
      .from(dispute)
      .where(eq(dispute.id, disputeId))
      .for('update')
      .limit(1)

    if (!lockedDispute) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Dispute not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Re-check status after acquiring the lock to prevent double-refund races
    if (lockedDispute.status !== 'open') {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Dispute has already been resolved' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!isValidDisputeTransition(lockedDispute.status as DisputeStatus, 'resolved')) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Invalid dispute transition from '${lockedDispute.status}' to 'resolved'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const [lockedShopOrder] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, lockedDispute.shopOrderId))
      .for('update')
      .limit(1)

    if (!lockedShopOrder) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (lockedShopOrder.refundPendingCents > 0) {
      throw new Response(
        JSON.stringify({
          error: 'Conflict',
          message: 'A refund is already in progress for this shop order',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const shopOrderRefundIncrement = refundCents ?? 0
    let reversalOptions: {
      reverseRouting?: boolean
      routingReversals?: { organizationId: string; amountCents: number }[]
    } = {}

    if (input.resolution !== 'close') {
      reversalOptions = await reversePayoutForRefund(
        tx,
        lockedDispute.shopOrderId,
        shopOrderRefundIncrement,
        input.resolution,
      )

      await tx
        .update(shopOrder)
        .set({
          refundPendingCents: shopOrderRefundIncrement,
          lastRefundAttemptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shopOrder.id, lockedDispute.shopOrderId))

      await createCreditNoteForShopOrder(lockedDispute.shopOrderId, tx)
    }

    const [[updated]] = await Promise.all([
      tx
        .update(dispute)
        .set({
          status: 'resolved',
          resolution: input.resolution,
          refundCents,
          updatedAt: new Date(),
        })
        .where(eq(dispute.id, disputeId))
        .returning(),
      input.resolution === 'close'
        ? tx
            .update(shopOrder)
            .set({
              status: newOrderStatus,
              updatedAt: new Date(),
            })
            .where(eq(shopOrder.id, lockedDispute.shopOrderId))
        : Promise.resolve(),
      shopOrderRefundIncrement > 0
        ? tx
            .update(platformOrder)
            .set({
              refundedCents: sql`${platformOrder.refundedCents} + ${shopOrderRefundIncrement}`,
              updatedAt: new Date(),
            })
            .where(eq(platformOrder.id, lockedShopOrder.platformOrderId))
        : Promise.resolve(),
    ])

    await recalcPlatformOrderStatus(tx, lockedShopOrder.platformOrderId)

    const notificationData = {
      disputeId,
      shopOrderId: lockedDispute.shopOrderId,
      platformOrderId: lockedShopOrder.platformOrderId,
      orderNumber: platformOrderRecord?.orderNumber ?? '',
      resolution: input.resolution,
      refundCents,
    }

    // Notify buyer
    try {
      const { createNotification } = await import('../notifications.server')
      await createNotification(lockedDispute.buyerUserId, 'dispute_resolved', notificationData)
    } catch {
      // Notification errors must not break the primary business transaction
    }

    // Notify creator (shop owner)
    if (creatorUserId) {
      try {
        const { createNotification } = await import('../notifications.server')
        await createNotification(creatorUserId, 'dispute_resolved', notificationData)
      } catch {
        // Notification errors must not break the primary business transaction
      }
    }

    return {
      disputeRecord: lockedDispute,
      shopOrderRecord: lockedShopOrder,
      creatorUserId,
      resolvedDispute: {
        id: updated.id,
        status: updated.status,
        resolution: updated.resolution ?? '',
        refundCents: updated.refundCents,
        updatedAt: updated.updatedAt,
      },
      reversalOptions,
      shopOrderRefundIncrement,
    }
  })

  // Step 2: for refund resolutions, call Mollie after the intent is durable.
  if (input.resolution !== 'close' && result.shopOrderRefundIncrement > 0 && molliePaymentId) {
    try {
      await molliePaymentProvider.refundPayment(
        molliePaymentId,
        result.shopOrderRefundIncrement,
        result.reversalOptions,
      )
    } catch (err) {
      logger.error(
        `Mollie refund failed for payment ${molliePaymentId}, dispute ${disputeId}, amount ${result.shopOrderRefundIncrement} cents`,
        err,
        {
          alert: true,
          disputeId,
          molliePaymentId,
          refundCents: result.shopOrderRefundIncrement,
        },
      )
      throw new Response(
        JSON.stringify({
          error: 'Bad Gateway',
          message:
            'Mollie refund failed. The dispute is marked resolved but the refund must be retried.',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Step 3: finalize the shop order status now that the buyer is refunded.
    await db.transaction(async (tx) => {
      const [lockedShopOrder] = await tx
        .select({
          id: shopOrder.id,
          status: shopOrder.status,
          refundedCents: shopOrder.refundedCents,
          refundPendingCents: shopOrder.refundPendingCents,
          platformOrderId: shopOrder.platformOrderId,
        })
        .from(shopOrder)
        .where(eq(shopOrder.id, result.disputeRecord.shopOrderId))
        .for('update')
        .limit(1)

      if (
        !lockedShopOrder ||
        lockedShopOrder.refundPendingCents !== result.shopOrderRefundIncrement
      ) {
        logger.error(
          `Dispute refund finalization state mismatch for shop order ${result.disputeRecord.shopOrderId}`,
          undefined,
          {
            alert: true,
            shopOrderId: result.disputeRecord.shopOrderId,
            refundCents: result.shopOrderRefundIncrement,
            refundPendingCents: lockedShopOrder?.refundPendingCents,
          },
        )
        throw new Response(
          JSON.stringify({
            error: 'Conflict',
            message: 'Refund state changed during finalization',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await tx
        .update(shopOrder)
        .set({
          status: 'refunded',
          refundedCents: lockedShopOrder.refundedCents + result.shopOrderRefundIncrement,
          refundPendingCents: 0,
          updatedAt: new Date(),
        })
        .where(eq(shopOrder.id, lockedShopOrder.id))

      // Inventory is only restored for full refunds; partial refunds leave the
      // sale in place and close leaves the sale final.
      if (input.resolution === 'full_refund') {
        await restoreShopOrderStockInTx(tx, lockedShopOrder.platformOrderId, lockedShopOrder.id)
      }

      await recalcPlatformOrderStatus(tx, lockedShopOrder.platformOrderId)
    })
  }

  const {
    disputeRecord: finalDisputeRecord,
    shopOrderRecord: finalShopOrderRecord,
    creatorUserId: finalCreatorUserId,
    resolvedDispute,
  } = result

  logOrderResolved({
    disputeId,
    shopOrderId: finalDisputeRecord.shopOrderId,
    platformOrderId: finalShopOrderRecord.platformOrderId,
    resolution: input.resolution,
    refundCents: resolvedDispute.refundCents,
  })

  // Send dispute update emails after the transaction
  try {
    const [{ sendNotificationEmail }, [buyerRecord], [sellerRecord], [shopRecord2]] =
      await Promise.all([
        import('../notifications.server'),
        db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, finalDisputeRecord.buyerUserId))
          .limit(1),
        db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, finalCreatorUserId ?? ''))
          .limit(1),
        db.select().from(shop).where(eq(shop.id, finalShopOrderRecord.shopId)).limit(1),
      ])

    const baseUrl = getBaseUrl()
    const message =
      input.resolution === 'close'
        ? 'The dispute has been closed.'
        : input.resolution === 'full_refund'
          ? 'A full refund has been issued.'
          : input.resolution === 'partial_refund'
            ? `A partial refund has been issued.`
            : 'The dispute has been resolved.'

    const resolvedOrderNumber =
      platformOrderRecord?.orderNumber ?? finalDisputeRecord.shopOrderId.slice(0, 8)

    await sendNotificationEmail({
      userId: finalDisputeRecord.buyerUserId,
      template: 'dispute_update',
      data: {
        orderNumber: resolvedOrderNumber,
        buyerName: buyerRecord?.name,
        shopName: shopRecord2?.name ?? 'Eurtisan',
        status: input.resolution,
        message,
        disputeUrl: `${baseUrl}/disputes/${disputeId}`,
      },
      idempotencyKey: `dispute:${disputeId}:${input.resolution}`,
      category: 'transactional',
    })

    if (finalCreatorUserId) {
      await sendNotificationEmail({
        userId: finalCreatorUserId,
        template: 'dispute_update',
        data: {
          orderNumber: resolvedOrderNumber,
          buyerName: sellerRecord?.name,
          shopName: shopRecord2?.name ?? 'Eurtisan',
          status: input.resolution,
          message,
          disputeUrl: `${baseUrl}/disputes/${disputeId}`,
        },
        idempotencyKey: `dispute:${disputeId}:${input.resolution}:seller`,
        category: 'transactional',
      })
    }
  } catch {
    // Email errors must not break the primary business flow
  }

  return resolvedDispute
}