import '@tanstack/react-start/server-only'

import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type z from 'zod'
import { db } from '#/db/index'
import {
  auditLog,
  notification,
  orderItem,
  payout,
  platformOrder,
  product,
  returnRequest,
  returnRequestItem,
  returnRequestMessage,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import type { ShippingAddress as ProviderAddress } from '#/lib/shipping/types'
import { scheduleBackgroundWork } from '../background-work.server'
import { enqueueEmail } from '../email/outbox.server'
import { decrypt, decryptJsonb } from '../encryption.server'
import { getBaseUrl } from '../env.server'
import { calculatePackageFromItems } from '../shipping-estimate'
import { createCreditNoteForShopOrder } from '../invoices.server'
import { logger } from '../logger.server'
import { recalcPlatformOrderStatus } from '../shop-orders.server'
import { reversePayoutForRefund } from '../payouts.server'
import type { PayoutReversalOptions } from '../payouts/types'
import type {
  addReturnMessageSchema,
  createReturnRequestSchema,
  manageReturnRequestSchema,
  updateReturnShipmentSchema,
} from './schemas'
import {
  calculateReturnRefund,
  getReturnDeadline,
  getReturnEligibility,
  RETURN_POLICY_VERSION,
  type ReturnPolicy,
} from './rules'
import type { ReturnRequestSummary, ReturnRequestStatus } from './types'

function response(status: number, code: string, message: string): never {
  throw new Response(JSON.stringify({ error: code, code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function emitReturnAudit(
  actorId: string,
  action: string,
  returnRequestId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const [actor] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, actorId))
      .limit(1)
    if (!actor) return
    await db.insert(auditLog).values({
      actorId,
      actorName: actor.name,
      action,
      resourceType: 'return_request',
      resourceId: returnRequestId,
      metadata,
    })
  } catch (error) {
    logger.error('Return audit emission failed', error, {
      alert: true,
      actorId,
      action,
      returnRequestId,
    })
  }
}

export async function createReturnRequestQuery(
  input: z.infer<typeof createReturnRequestSchema>,
  buyerUserId: string,
): Promise<ReturnRequestSummary> {
  const now = new Date()
  const createdId = await db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        shopOrder,
        platformUserId: platformOrder.userId,
      })
      .from(shopOrder)
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .where(eq(shopOrder.id, input.shopOrderId))
      .for('update')
      .limit(1)
    if (!order || order.platformUserId !== buyerUserId)
      response(403, 'ACCESS_DENIED', 'Access denied')

    const requestedIds = [...new Set(input.items.map((item) => item.orderItemId))]
    if (requestedIds.length !== input.items.length) {
      response(400, 'RETURN_ITEMS_DUPLICATE', 'Each order item may be selected once')
    }
    const rows = await tx
      .select()
      .from(orderItem)
      .where(and(eq(orderItem.shopOrderId, input.shopOrderId), inArray(orderItem.id, requestedIds)))
    if (rows.length !== requestedIds.length)
      response(400, 'RETURN_ITEMS_INVALID', 'Invalid return items')

    const existingReturned = await tx
      .select({ orderItemId: returnRequestItem.orderItemId, quantity: returnRequestItem.quantity })
      .from(returnRequestItem)
      .innerJoin(returnRequest, eq(returnRequestItem.returnRequestId, returnRequest.id))
      .where(
        and(eq(returnRequest.shopOrderId, input.shopOrderId), ne(returnRequest.status, 'rejected')),
      )
    const returnedByItem = new Map<string, number>()
    for (const returned of existingReturned) {
      returnedByItem.set(
        returned.orderItemId,
        (returnedByItem.get(returned.orderItemId) ?? 0) + returned.quantity,
      )
    }

    const selected = input.items.map((selection) => {
      const item = rows.find((candidate) => candidate.id === selection.orderItemId)
      if (!item) response(400, 'RETURN_ITEMS_INVALID', 'Invalid return item')
      const remaining = item.quantity - (returnedByItem.get(item.id) ?? 0)
      if (selection.quantity > remaining) {
        response(409, 'RETURN_QUANTITY_UNAVAILABLE', 'The requested quantity is not returnable')
      }
      const eligibility = getReturnEligibility({
        type: input.type,
        deliveredAt: order.shopOrder.deliveredAt,
        returnPolicy: item.returnPolicySnapshot as ReturnPolicy,
        now,
      })
      if (!eligibility.eligible) {
        response(
          409,
          eligibility.exclusionCode ?? 'RETURN_NOT_ELIGIBLE',
          'This item is not eligible for this return',
        )
      }
      return { item, selection, deadline: eligibility.deadline }
    })

    const [itemCountRecord] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(orderItem)
      .where(eq(orderItem.shopOrderId, input.shopOrderId))
    const refund = calculateReturnRefund({
      items: selected.map(({ item, selection }) => ({
        unitPriceCents: item.unitPriceCents,
        quantity: selection.quantity,
        orderedQuantity: item.quantity,
      })),
      shopOrderItemCount: itemCountRecord?.count ?? rows.length,
      standardShippingCostCents: order.shopOrder.standardShippingCostCents,
    })
    const requestDeadline = selected[0]?.deadline ?? now
    const status = input.type === 'withdrawal' ? 'awaiting_shipment' : 'requested'
    const [created] = await tx
      .insert(returnRequest)
      .values({
        shopOrderId: input.shopOrderId,
        buyerUserId,
        type: input.type,
        status,
        reason: input.reason,
        returnShippingPayer: input.type === 'defective' ? 'seller' : 'buyer',
        policyVersion: RETURN_POLICY_VERSION,
        requestDeadline,
        returnDeadline: getReturnDeadline(now),
        refundCents: refund.totalCents,
        outboundShippingRefundCents: refund.outboundShippingRefundCents,
      })
      .returning({ id: returnRequest.id })

    await tx.insert(returnRequestItem).values(
      selected.map(({ item, selection }) => ({
        returnRequestId: created.id,
        orderItemId: item.id,
        quantity: selection.quantity,
        refundCents: item.unitPriceCents * selection.quantity,
      })),
    )
    return created.id
  })
  await emitReturnAudit(buyerUserId, 'return.create', createdId, {
    shopOrderId: input.shopOrderId,
    type: input.type,
  })
  const detail = await getReturnRequestQuery(createdId, buyerUserId, 'customer')
  if (!detail) response(500, 'RETURN_CREATE_FAILED', 'Return request could not be loaded')
  return detail
}

export async function getReturnAccessContextQuery(
  id: string,
): Promise<{ platformOrderId: string; buyerUserId: string } | null> {
  const [record] = await db
    .select({
      platformOrderId: shopOrder.platformOrderId,
      buyerUserId: returnRequest.buyerUserId,
    })
    .from(returnRequest)
    .innerJoin(shopOrder, eq(returnRequest.shopOrderId, shopOrder.id))
    .where(eq(returnRequest.id, id))
    .limit(1)
  return record ?? null
}

export async function getReturnRequestQuery(
  id: string,
  callerUserId: string,
  callerRole: string,
): Promise<ReturnRequestSummary | null> {
  const [record] = await db
    .select({ request: returnRequest, shopOwnerId: shop.ownerId })
    .from(returnRequest)
    .innerJoin(shopOrder, eq(returnRequest.shopOrderId, shopOrder.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .where(eq(returnRequest.id, id))
    .limit(1)
  if (!record) return null
  if (
    callerRole !== 'admin' &&
    record.request.buyerUserId !== callerUserId &&
    record.shopOwnerId !== callerUserId
  )
    response(403, 'ACCESS_DENIED', 'Access denied')

  const items = await db
    .select({
      id: returnRequestItem.id,
      orderItemId: returnRequestItem.orderItemId,
      productName: orderItem.productName,
      quantity: returnRequestItem.quantity,
      refundCents: returnRequestItem.refundCents,
    })
    .from(returnRequestItem)
    .innerJoin(orderItem, eq(returnRequestItem.orderItemId, orderItem.id))
    .where(eq(returnRequestItem.returnRequestId, id))
  return {
    ...record.request,
    status: record.request.status as ReturnRequestStatus,
    returnShippingPayer: record.request.returnShippingPayer as 'buyer' | 'seller',
    items,
  }
}

export async function listOrderReturnsQuery(
  platformOrderId: string,
  buyerUserId: string,
): Promise<ReturnRequestSummary[]> {
  const ids = await db
    .select({ id: returnRequest.id })
    .from(returnRequest)
    .innerJoin(shopOrder, eq(returnRequest.shopOrderId, shopOrder.id))
    .where(
      and(
        eq(shopOrder.platformOrderId, platformOrderId),
        eq(returnRequest.buyerUserId, buyerUserId),
      ),
    )
  const result: ReturnRequestSummary[] = []
  for (const row of ids) {
    const detail = await getReturnRequestQuery(row.id, buyerUserId, 'customer')
    if (detail) result.push(detail)
  }
  return result
}

export async function listShopOrderReturnsQuery(
  shopOrderId: string,
  caller: { userId: string; role: string },
): Promise<ReturnRequestSummary[]> {
  const ids = await db
    .select({ id: returnRequest.id })
    .from(returnRequest)
    .innerJoin(shopOrder, eq(returnRequest.shopOrderId, shopOrder.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .where(
      and(
        eq(returnRequest.shopOrderId, shopOrderId),
        caller.role === 'admin' ? sql`true` : eq(shop.ownerId, caller.userId),
      ),
    )
  const result: ReturnRequestSummary[] = []
  for (const row of ids) {
    const detail = await getReturnRequestQuery(row.id, caller.userId, caller.role)
    if (detail) result.push(detail)
  }
  return result
}

export async function updateReturnShipmentQuery(
  input: z.infer<typeof updateReturnShipmentSchema>,
  buyerUserId: string,
): Promise<ReturnRequestSummary> {
  const [updated] = await db
    .update(returnRequest)
    .set({
      status: 'in_transit',
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(returnRequest.id, input.returnRequestId),
        eq(returnRequest.buyerUserId, buyerUserId),
        inArray(returnRequest.status, ['authorized', 'awaiting_shipment']),
      ),
    )
    .returning({ id: returnRequest.id })
  if (!updated) response(409, 'RETURN_NOT_SHIPPABLE', 'This return cannot be shipped')
  await emitReturnAudit(buyerUserId, 'return.shipment_update', updated.id, {
    carrier: input.carrier,
  })
  const detail = await getReturnRequestQuery(updated.id, buyerUserId, 'customer')
  if (!detail) response(404, 'RETURN_NOT_FOUND', 'Return request not found')
  return detail
}

async function createSellerFundedReturnLabel(returnRequestId: string): Promise<void> {
  const [record] = await db
    .select({
      request: returnRequest,
      order: platformOrder,
      shopRecord: shop,
    })
    .from(returnRequest)
    .innerJoin(shopOrder, eq(returnRequest.shopOrderId, shopOrder.id))
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .where(eq(returnRequest.id, returnRequestId))
    .limit(1)
  if (!record) return
  const buyer = decryptJsonb<{ street: string; city: string; postalCode: string; country: string }>(
    record.order.shippingAddress,
  )
  const seller = decryptJsonb<ProviderAddress>(
    record.shopRecord.businessAddress ?? record.shopRecord.shippingOrigin,
  )
  if (!seller?.street || !seller.city || !seller.postalCode || !seller.country) {
    response(409, 'RETURN_ADDRESS_MISSING', 'The seller return address is unavailable')
  }
  const returnItems = await db
    .select({
      quantity: returnRequestItem.quantity,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
    })
    .from(returnRequestItem)
    .innerJoin(orderItem, eq(returnRequestItem.orderItemId, orderItem.id))
    .innerJoin(product, eq(orderItem.productId, product.id))
    .where(eq(returnRequestItem.returnRequestId, returnRequestId))
  const packageDetails = calculatePackageFromItems(returnItems)
  const provider = getShippingProvider()
  const rates = await provider.getRates(buyer, seller, packageDetails)
  const rate = rates[0]
  if (!rate) response(503, 'RETURN_LABEL_UNAVAILABLE', 'A return label is temporarily unavailable')
  const label = await provider.createLabel({
    origin: buyer,
    destination: seller,
    package: packageDetails,
    carrierService: rate.rateId,
    reference: `return-${returnRequestId}`,
    declaredValueCents: record.request.refundCents,
  })
  await db
    .update(returnRequest)
    .set({
      status: 'awaiting_shipment',
      carrier: label.carrier,
      trackingNumber: label.trackingNumber,
      labelUrl: label.labelUrl,
      updatedAt: new Date(),
    })
    .where(eq(returnRequest.id, returnRequestId))
}

export async function manageReturnRequestQuery(
  input: z.infer<typeof manageReturnRequestSchema>,
  caller: { userId: string; role: string },
): Promise<ReturnRequestSummary> {
  const detail = await getReturnRequestQuery(input.returnRequestId, caller.userId, caller.role)
  if (!detail) response(404, 'RETURN_NOT_FOUND', 'Return request not found')
  if (detail.buyerUserId === caller.userId && caller.role !== 'admin') {
    response(403, 'ACCESS_DENIED', 'Seller or admin access required')
  }

  if (input.action === 'authorize') {
    if (!['requested', 'authorized'].includes(detail.status))
      response(409, 'RETURN_STATE_INVALID', 'Return is not awaiting authorization')
    if (detail.status === 'requested') {
      await db
        .update(returnRequest)
        .set({ status: 'authorized', rejectionReason: null, updatedAt: new Date() })
        .where(eq(returnRequest.id, detail.id))
    }
    if (detail.returnShippingPayer === 'seller') await createSellerFundedReturnLabel(detail.id)
  } else if (input.action === 'reject') {
    if (!input.reason) response(400, 'RETURN_REASON_REQUIRED', 'A rejection reason is required')
    await db
      .update(returnRequest)
      .set({ status: 'rejected', rejectionReason: input.reason, updatedAt: new Date() })
      .where(eq(returnRequest.id, detail.id))
  } else if (input.action === 'mark_received') {
    if (!['in_transit', 'awaiting_shipment'].includes(detail.status)) {
      response(409, 'RETURN_STATE_INVALID', 'Return is not in transit')
    }
    await db
      .update(returnRequest)
      .set({ status: 'received', receivedAt: new Date(), updatedAt: new Date() })
      .where(eq(returnRequest.id, detail.id))
  } else if (input.action === 'refund') {
    await refundReturnRequest(detail.id)
  } else if (input.action === 'close') {
    await db
      .update(returnRequest)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(returnRequest.id, detail.id))
  }

  await emitReturnAudit(caller.userId, `return.${input.action}`, detail.id, {
    previousStatus: detail.status,
  })
  const updated = await getReturnRequestQuery(detail.id, caller.userId, caller.role)
  if (!updated) response(404, 'RETURN_NOT_FOUND', 'Return request not found')
  return updated
}

async function refundReturnRequest(id: string): Promise<void> {
  const intent = await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(returnRequest)
      .where(eq(returnRequest.id, id))
      .for('update')
      .limit(1)
    if (!request) response(404, 'RETURN_NOT_FOUND', 'Return request not found')
    if (!['received', 'refund_pending'].includes(request.status))
      response(409, 'RETURN_STATE_INVALID', 'Return must be received before refund')
    const [order] = await tx
      .select({
        shopOrder,
        paymentId: platformOrder.molliePaymentId,
        orderNumber: platformOrder.orderNumber,
        buyerEmail: platformOrder.buyerEmail,
        shippingAddress: platformOrder.shippingAddress,
        isGuest: platformOrder.isGuest,
        shopName: shop.name,
      })
      .from(shopOrder)
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .innerJoin(shop, eq(shopOrder.shopId, shop.id))
      .where(eq(shopOrder.id, request.shopOrderId))
      .for('update')
      .limit(1)
    if (!order?.paymentId) response(409, 'PAYMENT_NOT_FOUND', 'Original payment is unavailable')
    if (request.status === 'refund_pending') {
      if (order.shopOrder.refundPendingCents !== request.refundCents) {
        response(409, 'REFUND_STATE_INVALID', 'Pending refund amount does not match the return')
      }
      const [payoutRecord] = await tx
        .select({ payout, mollieAccountId: shop.mollieAccountId })
        .from(payout)
        .innerJoin(shop, eq(payout.shopId, shop.id))
        .where(eq(payout.shopOrderId, request.shopOrderId))
        .limit(1)
      let reversalOptions: PayoutReversalOptions = {}
      if (
        payoutRecord?.payout.status === 'reversed' &&
        payoutRecord.payout.reversalReason === `return:${request.id}`
      ) {
        reversalOptions = { reverseRouting: true }
      } else if (
        payoutRecord &&
        ['sent', 'in_transit'].includes(payoutRecord.payout.status) &&
        payoutRecord.mollieAccountId
      ) {
        reversalOptions = {
          routingReversals: [
            {
              organizationId: payoutRecord.mollieAccountId,
              amountCents: Math.min(request.refundCents, payoutRecord.payout.amountCents),
            },
          ],
        }
      }
      return {
        request,
        order: order.shopOrder,
        orderRecord: order,
        paymentId: order.paymentId,
        reversalOptions,
      }
    }
    if (order.shopOrder.refundPendingCents > 0)
      response(409, 'REFUND_IN_PROGRESS', 'A refund is already in progress')

    const reversalOptions = await reversePayoutForRefund(
      tx,
      request.shopOrderId,
      request.refundCents,
      `return:${request.id}`,
    )
    await createCreditNoteForShopOrder(request.shopOrderId, tx, request.refundCents)
    await tx
      .update(returnRequest)
      .set({ status: 'refund_pending', refundAttemptedAt: new Date(), updatedAt: new Date() })
      .where(eq(returnRequest.id, id))
    await tx
      .update(shopOrder)
      .set({ refundPendingCents: request.refundCents, updatedAt: new Date() })
      .where(eq(shopOrder.id, request.shopOrderId))
    await tx
      .update(platformOrder)
      .set({
        refundedCents: sql`${platformOrder.refundedCents} + ${request.refundCents}`,
        updatedAt: new Date(),
      })
      .where(eq(platformOrder.id, order.shopOrder.platformOrderId))
    return {
      request,
      order: order.shopOrder,
      orderRecord: order,
      paymentId: order.paymentId,
      reversalOptions,
    }
  })

  try {
    const { molliePaymentProvider } = await import('#/integrations/mollie')
    await molliePaymentProvider.refundPayment(intent.paymentId, intent.request.refundCents, {
      ...intent.reversalOptions,
      idempotencyKey: `return-refund-${intent.request.id}`,
    })
  } catch (error) {
    logger.error('Return refund provider call failed', error, { alert: true, returnRequestId: id })
    response(
      502,
      'RETURN_REFUND_FAILED',
      'The refund is queued for reconciliation and must be retried',
    )
  }

  await db.transaction(async (tx) => {
    const items = await tx
      .select({ productId: orderItem.productId, quantity: returnRequestItem.quantity })
      .from(returnRequestItem)
      .innerJoin(orderItem, eq(returnRequestItem.orderItemId, orderItem.id))
      .where(eq(returnRequestItem.returnRequestId, id))
    for (const item of items) {
      await tx
        .update(product)
        .set({ stockCount: sql`${product.stockCount} + ${item.quantity}`, updatedAt: new Date() })
        .where(eq(product.id, item.productId))
    }
    await tx
      .update(returnRequest)
      .set({ status: 'refunded', refundedAt: new Date(), updatedAt: new Date() })
      .where(eq(returnRequest.id, id))
    const cumulativeRefund = intent.order.refundedCents + intent.request.refundCents
    const orderTotal = intent.order.subtotalCents + intent.order.shippingCostCents
    await tx
      .update(shopOrder)
      .set({
        status: cumulativeRefund >= orderTotal ? 'refunded' : intent.order.status,
        refundedCents: cumulativeRefund,
        refundPendingCents: 0,
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, intent.order.id))
    await recalcPlatformOrderStatus(tx, intent.order.platformOrderId)
    await tx.insert(notification).values({
      userId: intent.request.buyerUserId,
      type: 'order_refunded',
      data: {
        platformOrderId: intent.order.platformOrderId,
        shopOrderId: intent.order.id,
        returnRequestId: id,
        refundCents: intent.request.refundCents,
        targetPath: `/returns/${id}`,
      },
    })
  })

  scheduleBackgroundWork(`return-refund-email-${id}`, async () => {
    if (!intent.orderRecord.buyerEmail) return
    const shippingAddress = decryptJsonb<{ name?: string }>(intent.orderRecord.shippingAddress)
    await enqueueEmail({
      to: decrypt(intent.orderRecord.buyerEmail),
      userId: intent.orderRecord.isGuest ? null : intent.request.buyerUserId,
      template: 'order_refunded',
      category: 'transactional',
      idempotencyKey: `return:${id}:refunded`,
      data: {
        orderNumber: intent.orderRecord.orderNumber,
        buyerName: shippingAddress?.name ?? 'Customer',
        shopName: intent.orderRecord.shopName,
        refundAmount: `${(intent.request.refundCents / 100).toFixed(2)} EUR`,
        orderUrl: intent.orderRecord.isGuest
          ? ''
          : `${getBaseUrl()}/orders/${intent.order.platformOrderId}`,
      },
    })
  })
}

export async function addReturnMessageQuery(
  input: z.infer<typeof addReturnMessageSchema>,
  caller: { userId: string; role: string },
): Promise<void> {
  const detail = await getReturnRequestQuery(input.returnRequestId, caller.userId, caller.role)
  if (!detail) response(404, 'RETURN_NOT_FOUND', 'Return request not found')
  await db.insert(returnRequestMessage).values({
    returnRequestId: input.returnRequestId,
    senderUserId: caller.userId,
    message: input.message,
  })
}
