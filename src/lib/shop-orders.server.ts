import { and, count, desc, eq, gte, ilike, isNull, ne, or, sql, sum } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  dispute,
  inventoryReservation,
  orderItem,
  payout,
  platformOrder,
  product,
  productVariant,
  shippingLabel,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import { molliePaymentProvider } from '#/integrations/mollie'
import type { PaymentProvider } from './payment-provider'
import { DISPUTE_WINDOW_DAYS } from './constants'
import { scheduleBackgroundWork } from './background-work.server'
import { restoreShopOrderStockInTx } from './inventory.server'
import { createCreditNoteForShopOrder, createInvoicesForPlatformOrder } from './invoices.server'
import type { ShippingAddress } from './checkout.server'
import { decryptJsonb } from './encryption.server'
import { getBaseUrl } from './env.server'
import { logger } from './logger.server'
import {
  logOrderCancelled,
  logOrderDelivered,
  logOrderShipped,
  logOrderTrackingUpdated,
  logManualReviewResolved,
} from './order-logger'
import type { OrderStatus } from './orders.server'
import { createPayoutForShopOrder, reversePayoutForRefund } from './payouts.server'
import { calculatePackageFromItems } from './shipping-estimate'
import { validatePlainText, validateTrackingUrl } from './xss'

function addDisputeWindow(date = new Date()): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + DISPUTE_WINDOW_DAYS)
  return d
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const maskedLocal = local.length > 1 ? `${local[0]}***` : '***'
  return `${maskedLocal}@${domain}`
}

export interface ShopOrderItemDetail {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
}

export interface ShopOrderBuyer {
  id: string
  name: string
  email: string
}

export interface ShippingLabelDetail {
  id: string
  carrier: string
  trackingNumber: string | null
  labelUrl: string | null
  createdAt: Date
}

export interface ShopOrderDetail {
  id: string
  platformOrderId: string
  platformOrderNumber: string
  shopId: string
  status: string
  shippingMethod: 'standard' | 'express' | 'manual'
  shippingRateId: string | null
  shippingCostCents: number
  subtotalCents: number
  vatAmountCents: number
  shippingVatRateBasisPoints: number
  shippingVatAmountCents: number
  trackingNumber: string | null
  trackingUrl: string | null
  createdAt: Date
  updatedAt: Date
  buyer: ShopOrderBuyer
  shippingAddress: ShippingAddress
  items: ShopOrderItemDetail[]
  labels: ShippingLabelDetail[]
}

export interface ShopOrderListItem {
  id: string
  platformOrderId: string
  platformOrderNumber: string
  status: string
  shippingMethod: 'standard' | 'express' | 'manual'
  shippingCostCents: number
  subtotalCents: number
  totalCents: number
  trackingNumber: string | null
  createdAt: Date
  buyerName: string
  buyerEmail: string
  itemCount: number
}

/* -------------------------------------------------------------------------- */
/*                             Status State Machine                           */
/* -------------------------------------------------------------------------- */

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled', 'refunded'],
  paid: ['processing', 'shipped', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered', 'disputed', 'refunded'],
  delivered: ['completed', 'disputed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  disputed: ['refunded', 'completed'],
  manual_review: ['paid', 'cancelled', 'refunded'],
  chargeback: [],
}

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/* -------------------------------------------------------------------------- */
/*                          Derived Platform Status                           */
/* -------------------------------------------------------------------------- */

export function derivePlatformStatus(shopOrderStatuses: OrderStatus[]): OrderStatus {
  if (shopOrderStatuses.length === 0) {
    return 'pending_payment'
  }

  // 1. If ANY shop order is under manual review, the overall status is manual_review.
  if (shopOrderStatuses.some((s) => s === 'manual_review')) {
    return 'manual_review'
  }

  // 2. If ANY shop order is disputed, the overall status is disputed.
  if (shopOrderStatuses.some((s) => s === 'disputed')) {
    return 'disputed'
  }

  if (shopOrderStatuses.some((s) => s === 'chargeback')) {
    return 'chargeback'
  }

  // 3. Filter out cancelled and refunded statuses for active resolution derivation.
  const nonTerminalStatuses = shopOrderStatuses.filter((s) => s !== 'cancelled' && s !== 'refunded')

  if (nonTerminalStatuses.length === 0) {
    // If all are cancelled/refunded, return refunded if any are refunded, otherwise cancelled.
    if (shopOrderStatuses.some((s) => s === 'refunded')) {
      return 'refunded'
    }
    return 'cancelled'
  }

  // 3. Base checks on remaining active (non-cancelled, non-refunded) shop orders:
  if (nonTerminalStatuses.some((s) => s === 'pending_payment')) {
    return 'pending_payment'
  }
  if (nonTerminalStatuses.every((s) => s === 'completed')) {
    return 'completed'
  }
  if (nonTerminalStatuses.every((s) => s === 'delivered' || s === 'completed')) {
    return 'delivered'
  }
  if (nonTerminalStatuses.every((s) => ['shipped', 'delivered', 'completed'].includes(s))) {
    return 'shipped'
  }
  if (nonTerminalStatuses.some((s) => s === 'processing')) {
    return 'processing'
  }
  if (
    nonTerminalStatuses.every((s) =>
      ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(s),
    )
  ) {
    return 'paid'
  }

  return 'pending_payment'
}

export async function recalcPlatformOrderStatus(
  tx: Omit<typeof db, '$client'>,
  platformOrderId: string,
): Promise<void> {
  const childStatuses = await tx
    .select({ status: shopOrder.status })
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  const statuses = childStatuses.map((s) => s.status as OrderStatus)
  const derived = derivePlatformStatus(statuses)

  await tx
    .update(platformOrder)
    .set({ status: derived, updatedAt: new Date() })
    .where(eq(platformOrder.id, platformOrderId))
}

export async function getShopOrderQuery(
  shopOrderId: string,
  tx: Omit<typeof db, '$client'> = db,
): Promise<ShopOrderDetail | null> {
  const [header] = await tx
    .select({
      shopOrder,
      platformOrderNumber: platformOrder.orderNumber,
      shippingAddress: platformOrder.shippingAddress,
      buyerId: user.id,
      buyerName: user.name,
      buyerEmail: user.email,
    })
    .from(shopOrder)
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(platformOrder.userId, user.id))
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)

  if (!header) {
    return null
  }

  const [items, labelRecords] = await Promise.all([
    tx
      .select({
        id: orderItem.id,
        productId: orderItem.productId,
        productName: orderItem.productName,
        unitPriceCents: orderItem.unitPriceCents,
        quantity: orderItem.quantity,
        totalCents: orderItem.totalCents,
        vatRateBasisPoints: orderItem.vatRateBasisPoints,
        vatAmountCents: orderItem.vatAmountCents,
        weightGrams: orderItem.weightGrams,
        lengthCm: orderItem.lengthCm,
        widthCm: orderItem.widthCm,
        heightCm: orderItem.heightCm,
      })
      .from(orderItem)
      .where(eq(orderItem.shopOrderId, shopOrderId)),
    tx
      .select({
        id: shippingLabel.id,
        carrier: shippingLabel.carrier,
        trackingNumber: shippingLabel.trackingNumber,
        labelUrl: shippingLabel.labelUrl,
        createdAt: shippingLabel.createdAt,
      })
      .from(shippingLabel)
      .where(eq(shippingLabel.shopOrderId, shopOrderId)),
  ])

  const shopOrderRecord = header.shopOrder

  return {
    id: shopOrderRecord.id,
    platformOrderId: shopOrderRecord.platformOrderId,
    platformOrderNumber: header.platformOrderNumber,
    shopId: shopOrderRecord.shopId,
    status: shopOrderRecord.status,
    shippingMethod: shopOrderRecord.shippingMethod,
    shippingRateId: shopOrderRecord.shippingRateId ?? null,
    shippingCostCents: shopOrderRecord.shippingCostCents,
    subtotalCents: shopOrderRecord.subtotalCents,
    vatAmountCents: shopOrderRecord.vatAmountCents,
    shippingVatRateBasisPoints: shopOrderRecord.shippingVatRateBasisPoints,
    shippingVatAmountCents: shopOrderRecord.shippingVatAmountCents,
    trackingNumber: shopOrderRecord.trackingNumber,
    trackingUrl: shopOrderRecord.trackingUrl,
    createdAt: shopOrderRecord.createdAt,
    updatedAt: shopOrderRecord.updatedAt,
    buyer: {
      id: header.buyerId,
      name: header.buyerName ?? 'Unknown',
      email: header.buyerEmail ?? '',
    },
    shippingAddress: decryptJsonb<ShippingAddress>(header.shippingAddress),
    items,
    labels: labelRecords,
  }
}

export async function getShopOrderDetailQuery(
  shopOrderId: string,
  tx: Omit<typeof db, '$client'> = db,
): Promise<ShopOrderDetail | null> {
  const order = await getShopOrderQuery(shopOrderId, tx)
  if (!order) return null

  return {
    ...order,
    buyer: {
      ...order.buyer,
      email: maskEmail(order.buyer.email),
    },
  }
}

export async function listShopOrdersQuery(
  shopId: string,
  options: {
    status?: string
    search?: string
    page?: number
    pageSize?: number
  } = {},
): Promise<{
  orders: ShopOrderListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const offset = (page - 1) * pageSize

  const conditions = [eq(shopOrder.shopId, shopId)]

  if (options.status) {
    conditions.push(eq(shopOrder.status, options.status as typeof shopOrder.$inferSelect.status))
  }

  if (options.search?.trim()) {
    const searchTerm = `%${options.search.trim()}%`
    const searchCondition = or(
      ilike(user.name, searchTerm),
      ilike(platformOrder.orderNumber, searchTerm),
      ilike(sql<string>`CAST(${shopOrder.id} AS TEXT)`, searchTerm),
    )
    if (searchCondition) conditions.push(searchCondition)
  }

  const where = and(...conditions)

  const [totalResult] = await db
    .select({ total: count() })
    .from(shopOrder)
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(platformOrder.userId, user.id))
    .where(where)
  const total = totalResult?.total ?? 0

  const orders = await db
    .select({
      id: shopOrder.id,
      platformOrderId: shopOrder.platformOrderId,
      platformOrderNumber: platformOrder.orderNumber,
      status: shopOrder.status,
      shippingMethod: shopOrder.shippingMethod,
      shippingCostCents: shopOrder.shippingCostCents,
      subtotalCents: shopOrder.subtotalCents,
      trackingNumber: shopOrder.trackingNumber,
      createdAt: shopOrder.createdAt,
      buyerName: user.name,
      buyerEmail: user.email,
      itemCount: count(orderItem.id),
    })
    .from(shopOrder)
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(platformOrder.userId, user.id))
    .leftJoin(orderItem, eq(orderItem.shopOrderId, shopOrder.id))
    .where(where)
    .groupBy(shopOrder.id, platformOrder.orderNumber, user.name, user.email)
    .orderBy(desc(shopOrder.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    orders: orders.map((o) => ({
      ...o,
      buyerEmail: maskEmail(o.buyerEmail),
      totalCents: o.subtotalCents + o.shippingCostCents,
      itemCount: Number(o.itemCount),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/* -------------------------------------------------------------------------- */
/*                          Update Shop Order Status                          */
/* -------------------------------------------------------------------------- */

export interface UpdateShopOrderStatusInput {
  status: OrderStatus
  trackingNumber?: string | null
  trackingUrl?: string | null
}

export async function markShopOrderShippedQuery(
  shopOrderId: string,
  input: {
    trackingNumber?: string | null
    trackingUrl?: string | null
  },
): Promise<ShopOrderDetail> {
  const validatedTrackingUrl = validateTrackingUrl(input.trackingUrl)

  const { result, didTransition } = await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!record) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const currentStatus = record.status as OrderStatus

    // Idempotency: already shipped — allow updating tracking info
    if (currentStatus === 'shipped') {
      const updateData: Partial<typeof shopOrder.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (input.trackingNumber !== undefined) {
        updateData.trackingNumber = input.trackingNumber
          ? validatePlainText(input.trackingNumber, 'Tracking number')
          : input.trackingNumber
      }
      if (input.trackingUrl !== undefined) {
        updateData.trackingUrl = validatedTrackingUrl
      }

      if (Object.keys(updateData).length > 1) {
        await tx.update(shopOrder).set(updateData).where(eq(shopOrder.id, shopOrderId))
      }

      const updated = await getShopOrderQuery(shopOrderId, tx)
      if (!updated) {
        throw new Response(
          JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return { result: updated, didTransition: false }
    }

    if (!isValidStatusTransition(currentStatus, 'shipped')) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Invalid status transition from '${currentStatus}' to 'shipped'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const updateData: Partial<typeof shopOrder.$inferInsert> = {
      status: 'shipped',
      updatedAt: new Date(),
    }
    if (input.trackingNumber !== undefined) {
      updateData.trackingNumber = input.trackingNumber
        ? validatePlainText(input.trackingNumber, 'Tracking number')
        : input.trackingNumber
    }
    if (input.trackingUrl !== undefined) {
      updateData.trackingUrl = input.trackingUrl
    }

    // Sequential within transaction: recalc depends on the update, and getShopOrderQuery
    // reads the updated state.
    await tx.update(shopOrder).set(updateData).where(eq(shopOrder.id, shopOrderId))

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return { result: updated, didTransition: true }
  })

  // Notify buyer after the transaction so errors don't break the shipment update
  // Only notify on actual status transition, not idempotent tracking updates
  if (didTransition) {
    scheduleBackgroundWork(
      'shop_order_shipped_notifications',
      async () => {
        const [{ createNotification, sendNotificationEmail }, order] = await Promise.all([
          import('./notifications.server'),
          getShopOrderQuery(shopOrderId),
        ])
        if (order) {
          const [, [shopRecord], [latestLabel]] = await Promise.all([
            createNotification(order.buyer.id, 'order_shipped', {
              platformOrderId: order.platformOrderId,
              orderNumber: order.platformOrderNumber,
              shopOrderId,
            }),
            db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1),
            db
              .select({ carrier: shippingLabel.carrier })
              .from(shippingLabel)
              .where(eq(shippingLabel.shopOrderId, shopOrderId))
              .orderBy(sql`${shippingLabel.createdAt} DESC`)
              .limit(1),
          ])
          await sendNotificationEmail({
            userId: order.buyer.id,
            template: 'shipping_notification',
            data: {
              orderNumber: order.platformOrderNumber,
              buyerName: order.buyer.name,
              shopName: shopRecord?.name ?? 'Eurtisan',
              trackingNumber: order.trackingNumber ?? null,
              carrier: latestLabel?.carrier ?? 'Sendcloud',
              trackingUrl: order.trackingUrl ?? null,
            },
            idempotencyKey: `order:${shopOrderId}:shipped`,
            category: 'transactional',
          })
        }
      },
      { shopOrderId },
    )

    logOrderShipped({
      shopOrderId,
      platformOrderId: result.platformOrderId,
      trackingNumber: result.trackingNumber,
      trackingUrl: result.trackingUrl,
    })
  }

  return result
}

/* -------------------------------------------------------------------------- */
/*                          Shipping Label Generation                         */
/* -------------------------------------------------------------------------- */

export interface CreateLabelInput {
  shopOrderId: string
}

export async function createShippingLabelForOrderQuery(
  shopOrderId: string,
): Promise<ShippingLabelDetail> {
  const order = await getShopOrderQuery(shopOrderId)
  if (!order) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [shopRecord] = await db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1)

  if (!shopRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const origin = shopRecord.shippingOrigin as {
    street: string
    city: string
    postalCode: string
    country: string
  } | null

  if (!origin) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Shop shipping origin address is not configured',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const destination = order.shippingAddress

  // Build a shipping package from the order items, using real dimensions when available.
  const pkg = calculatePackageFromItems(order.items)

  try {
    const provider = getShippingProvider()
    const label = await provider.createLabel({
      origin,
      destination,
      package: pkg,
      carrierService:
        order.shippingRateId ?? (order.shippingMethod === 'express' ? 'express' : 'standard'),
      reference: shopOrderId,
      pickupPoint: order.shippingAddress.pickupPoint,
      declaredValueCents: order.subtotalCents + order.shippingCostCents,
    })

    // Insert shipping_label row (provider may also insert, but we ensure it here)
    const [record] = await db
      .insert(shippingLabel)
      .values({
        shopOrderId,
        carrier: label.carrier,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        externalParcelId: label.externalParcelId ?? null,
      })
      .returning()

    return {
      id: record.id,
      carrier: record.carrier,
      trackingNumber: record.trackingNumber,
      labelUrl: record.labelUrl,
      createdAt: record.createdAt,
    }
  } catch (err) {
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message:
          err instanceof Error
            ? err.message
            : 'Shipping label generation failed. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export async function markShopOrderShippedWithLabelQuery(
  shopOrderId: string,
): Promise<ShopOrderDetail> {
  // Step 1: create label first (outside transaction so provider network call
  // doesn't hold a DB transaction open).
  const label = await createShippingLabelForOrderQuery(shopOrderId)

  // Step 2: mark as shipped using the generated tracking info.
  return markShopOrderShippedQuery(shopOrderId, {
    trackingNumber: label.trackingNumber,
    trackingUrl: label.labelUrl,
  })
}

export async function markShopOrderDeliveredQuery(shopOrderId: string): Promise<ShopOrderDetail> {
  // Fetch current status before transaction to know if this is a real transition
  const { shopOrder: updatedShopOrder, didTransition } = await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!record) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const currentStatus = record.status as OrderStatus

    if (currentStatus === 'delivered') {
      const order = await getShopOrderQuery(shopOrderId, tx)
      if (!order) {
        throw new Response(
          JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return { shopOrder: order, didTransition: false }
    }

    if (!isValidStatusTransition(currentStatus, 'delivered')) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Invalid status transition from '${currentStatus}' to 'delivered'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const disputeWindowExpiresAt = record.disputeWindowExpiresAt ?? addDisputeWindow()

    // Sequential within transaction: recalc depends on the update, and getShopOrderQuery
    // reads the updated state.
    await tx
      .update(shopOrder)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        disputeWindowExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, shopOrderId))

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    // Create a pending payout record, but do not execute it yet. Payout release is
    // gated on the dispute window closing so sellers cannot be paid for orders that
    // are later disputed/refunded.
    await createPayoutForShopOrder(
      tx,
      shopOrderId,
      record.shopId,
      record.subtotalCents,
      record.vatAmountCents,
      record.shippingCostCents,
      record.shippingMethod as 'standard' | 'express' | 'manual',
    )

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return { shopOrder: updated, didTransition: true }
  })

  if (!updatedShopOrder) {
    throw new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to retrieve updated shop order',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (didTransition) {
    logOrderDelivered({
      shopOrderId,
      platformOrderId: updatedShopOrder.platformOrderId,
    })

    // Trigger DAC7 threshold warnings after the transaction commits so the
    // external/notification work does not extend the DB lock hold time.
    scheduleBackgroundWork(`dac7-warning-${shopOrderId}`, async () => {
      try {
        const { getDac7ComplianceStatus } = await import('./dac7.server')
        const currentYear = new Date().getFullYear()
        const dac7Status = await getDac7ComplianceStatus(updatedShopOrder.shopId, currentYear)

        if (dac7Status.approachingLimit || dac7Status.exceededLimit) {
          const [shopRecord] = await db
            .select({ ownerId: shop.ownerId, taxId: shop.taxId, name: shop.name })
            .from(shop)
            .where(eq(shop.id, updatedShopOrder.shopId))
            .limit(1)

          if (shopRecord && !shopRecord.taxId) {
            const { createNotification } = await import('./notifications.server')
            await createNotification(shopRecord.ownerId, 'dac7_warning_limit', {
              shopId: updatedShopOrder.shopId,
              shopName: shopRecord.name,
              transactionCount: dac7Status.transactionCount,
              grossSalesCents: dac7Status.grossSalesCents,
              limitType: dac7Status.exceededLimit ? 'exceeded' : 'approaching',
            })
          }
        }
      } catch (err) {
        logger.error('Failed to trigger DAC7 compliance warning', err, {
          shopOrderId,
          shopId: updatedShopOrder.shopId,
        })
      }
    })

    // Payout execution is intentionally deferred until the dispute window closes
    // to avoid paying sellers for later-disputed orders. The payout reconciliation
    // job releases held payouts once the window has expired.
  }

  return updatedShopOrder
}

export async function updateShopOrderStatusQuery(
  shopOrderId: string,
  input: UpdateShopOrderStatusInput,
): Promise<ShopOrderDetail> {
  const validatedTrackingUrl = validateTrackingUrl(input.trackingUrl)

  const updatedShopOrder = await db.transaction(async (tx) => {
    const [record] = await tx.select().from(shopOrder).where(eq(shopOrder.id, shopOrderId)).limit(1)

    if (!record) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const currentStatus = record.status as OrderStatus
    const nextStatus = input.status

    if (!isValidStatusTransition(currentStatus, nextStatus)) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Invalid status transition from '${currentStatus}' to '${nextStatus}'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Tracking info is only allowed when transitioning to shipped
    const updateData: Partial<typeof shopOrder.$inferInsert> = {
      status: nextStatus,
      updatedAt: new Date(),
    }

    if (nextStatus === 'shipped') {
      if (input.trackingNumber !== undefined) {
        updateData.trackingNumber = input.trackingNumber
          ? validatePlainText(input.trackingNumber, 'Tracking number')
          : input.trackingNumber
      }
      if (input.trackingUrl !== undefined) {
        updateData.trackingUrl = validatedTrackingUrl
      }
    }

    if (nextStatus === 'delivered' || nextStatus === 'completed') {
      updateData.disputeWindowExpiresAt = record.disputeWindowExpiresAt ?? addDisputeWindow()
      if (nextStatus === 'delivered') {
        updateData.deliveredAt = new Date()
      }
    }

    // Sequential within transaction: recalc depends on the update, and getShopOrderQuery
    // reads the updated state.
    await tx.update(shopOrder).set(updateData).where(eq(shopOrder.id, shopOrderId))

    // Recalculate parent platform order status
    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    // When the shop order transitions to paid and the platform order reaches
    // paid, commit the held inventory to actual stock.
    if (nextStatus === 'paid' && currentStatus !== 'paid') {
      const [platformRecord] = await tx
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, record.platformOrderId))
        .limit(1)

      if (platformRecord?.status === 'paid') {
        const { decrementStockForPaidOrder } = await import('./inventory.server')
        await decrementStockForPaidOrder(tx, record.platformOrderId)
      }
    }

    if (nextStatus === 'delivered' || nextStatus === 'completed') {
      await createPayoutForShopOrder(
        tx,
        shopOrderId,
        record.shopId,
        record.subtotalCents,
        record.vatAmountCents,
        record.shippingCostCents,
        record.shippingMethod as 'standard' | 'express' | 'manual',
      )
    }

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return updated
  })

  if (input.status === 'disputed') {
    scheduleBackgroundWork(
      'shop_order_dispute_notifications',
      async () => {
        const [{ createNotification, sendNotificationEmail }, order] = await Promise.all([
          import('./notifications.server'),
          getShopOrderQuery(shopOrderId),
        ])
        if (order) {
          const [, [disputeRecord], [shopRecord]] = await Promise.all([
            createNotification(order.buyer.id, 'dispute_opened', {
              platformOrderId: order.platformOrderId,
              orderNumber: order.platformOrderNumber,
              shopOrderId,
            }),
            db.select().from(dispute).where(eq(dispute.shopOrderId, shopOrderId)).limit(1),
            db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1),
          ])

          const baseUrl = getBaseUrl()
          await sendNotificationEmail({
            userId: order.buyer.id,
            template: 'dispute_update',
            data: {
              orderNumber: order.platformOrderNumber,
              buyerName: order.buyer.name,
              shopName: shopRecord?.name ?? 'Eurtisan',
              status: 'opened',
              disputeUrl: disputeRecord
                ? `${baseUrl}/disputes/${disputeRecord.id}`
                : `${baseUrl}/orders/${order.platformOrderId}`,
            },
            idempotencyKey: `dispute:${disputeRecord?.id ?? shopOrderId}:opened`,
            category: 'transactional',
          })
        }
      },
      { shopOrderId },
    )
  }

  return updatedShopOrder
}

/* -------------------------------------------------------------------------- */
/*                          Owner-Initiated Refund                            */
/* -------------------------------------------------------------------------- */

export interface RefundShopOrderResult {
  success: boolean
  shopOrderId: string
  creditNoteNumber: string | null
}

/**
 * Issues a refund for a shop order on behalf of the shop owner.
 *
 * Refunds include shipping costs on the final refund that zeroes out the
 * remaining total (P1-2). Money is only moved after a durable refund intent
 * has been written to the database (P0-22):
 *
 *   1. Record the intent (`refundPendingCents`), reverse any routed payout,
 *      and create the credit note inside a DB transaction.
 *   2. Call Mollie to refund the buyer.
 *   3. Finalize the order status and clear the pending intent.
 *
 * If Mollie fails after the intent is committed, the order is left in a
 * recoverable `refund_pending` state and an ops alert is emitted.
 */
export async function refundShopOrderQuery(
  userId: string,
  shopOrderId: string,
): Promise<RefundShopOrderResult> {
  const [orderRecord] = await db
    .select({
      id: shopOrder.id,
      platformOrderId: shopOrder.platformOrderId,
      shopId: shopOrder.shopId,
      status: shopOrder.status,
      subtotalCents: shopOrder.subtotalCents,
      shippingCostCents: shopOrder.shippingCostCents,
      refundedCents: shopOrder.refundedCents,
      refundPendingCents: shopOrder.refundPendingCents,
    })
    .from(shopOrder)
    .innerJoin(shop, eq(shop.id, shopOrder.shopId))
    .where(and(eq(shopOrder.id, shopOrderId), eq(shop.ownerId, userId)))
    .limit(1)

  if (!orderRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isValidStatusTransition(orderRecord.status as OrderStatus, 'refunded')) {
    throw new Response(
      JSON.stringify({
        error: 'Conflict',
        message: `Cannot refund a shop order in status '${orderRecord.status}'`,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (orderRecord.refundPendingCents > 0) {
    throw new Response(
      JSON.stringify({
        error: 'Conflict',
        message: 'A refund is already in progress for this shop order',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [platformOrderRecord] = await db
    .select({
      molliePaymentId: platformOrder.molliePaymentId,
      totalCents: platformOrder.totalCents,
    })
    .from(platformOrder)
    .where(eq(platformOrder.id, orderRecord.platformOrderId))
    .limit(1)

  if (!platformOrderRecord?.molliePaymentId) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Gateway',
        message: 'Parent payment is not available for refund',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const remainingTotalCents =
    orderRecord.subtotalCents + orderRecord.shippingCostCents - orderRecord.refundedCents
  if (remainingTotalCents <= 0) {
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'Order has already been fully refunded' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const refundCents = remainingTotalCents

  const molliePaymentId = platformOrderRecord.molliePaymentId

  // Step 1: record the refund intent, reverse any routed payout, and create
  // the credit note before contacting Mollie.
  const creditNoteNumber = await db.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({
        id: shopOrder.id,
        status: shopOrder.status,
        refundedCents: shopOrder.refundedCents,
        refundPendingCents: shopOrder.refundPendingCents,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!lockedOrder) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (
      !isValidStatusTransition(lockedOrder.status as OrderStatus, 'refunded') ||
      lockedOrder.refundedCents !== orderRecord.refundedCents ||
      lockedOrder.refundPendingCents !== 0
    ) {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Refund state changed during processing' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const reversalOptions = await reversePayoutForRefund(
      tx,
      shopOrderId,
      refundCents,
      'owner_refund',
    )

    await tx
      .update(shopOrder)
      .set({
        refundPendingCents: refundCents,
        lastRefundAttemptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, shopOrderId))

    const noteNumber = await createCreditNoteForShopOrder(shopOrderId, tx, refundCents)

    return { noteNumber, reversalOptions }
  })

  // Step 2: refund the buyer through Mollie.
  try {
    await molliePaymentProvider.refundPayment(molliePaymentId, refundCents, {
      ...creditNoteNumber.reversalOptions,
    })
  } catch (err) {
    logger.error(`Mollie refund failed for shop order ${shopOrderId}`, err, {
      alert: true,
      shopOrderId,
      molliePaymentId,
      refundCents,
    })
    throw new Response(JSON.stringify({ error: 'Bad Gateway', message: 'Mollie refund failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Step 3: finalize local records now that the buyer has been refunded.
  await db.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({
        id: shopOrder.id,
        status: shopOrder.status,
        refundedCents: shopOrder.refundedCents,
        refundPendingCents: shopOrder.refundPendingCents,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!lockedOrder || lockedOrder.refundPendingCents !== refundCents) {
      logger.error(`Refund finalization state mismatch for shop order ${shopOrderId}`, undefined, {
        alert: true,
        shopOrderId,
        refundCents,
        refundPendingCents: lockedOrder?.refundPendingCents,
      })
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Refund state changed during finalization' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    await tx
      .update(shopOrder)
      .set({
        status: 'refunded',
        refundedCents: lockedOrder.refundedCents + refundCents,
        refundPendingCents: 0,
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, shopOrderId))

    await tx
      .update(platformOrder)
      .set({
        refundedCents: sql`${platformOrder.refundedCents} + ${refundCents}`,
        updatedAt: new Date(),
      })
      .where(eq(platformOrder.id, orderRecord.platformOrderId))

    await restoreShopOrderStockInTx(tx, orderRecord.platformOrderId, shopOrderId)

    await recalcPlatformOrderStatus(tx, orderRecord.platformOrderId)
  })

  scheduleBackgroundWork(`refund-notifications-${shopOrderId}`, async () => {
    const [{ createNotification, sendNotificationEmail }, order] = await Promise.all([
      import('./notifications.server'),
      getShopOrderQuery(shopOrderId),
    ])
    if (order) {
      await createNotification(order.buyer.id, 'order_refunded', {
        platformOrderId: order.platformOrderId,
        shopOrderId,
        amountCents: refundCents,
      })
      const [shopRecord] = await db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1)
      const baseUrl = getBaseUrl()
      await sendNotificationEmail({
        userId: order.buyer.id,
        template: 'order_refunded',
        data: {
          orderNumber: shopOrderId.slice(0, 8),
          buyerName: order.buyer.name,
          shopName: shopRecord?.name ?? 'Eurtisan',
          refundAmount: `${(refundCents / 100).toFixed(2)}`,
          orderUrl: `${baseUrl}/orders/${order.platformOrderId}`,
        },
        idempotencyKey: `order:${shopOrderId}:refunded`,
        category: 'transactional',
      })
    }
  })

  return { success: true, shopOrderId, creditNoteNumber: creditNoteNumber.noteNumber }
}

/* -------------------------------------------------------------------------- */
/*                          Owner-Initiated Cancellation                      */
/* -------------------------------------------------------------------------- */

export interface CancelShopOrderInput {
  reason?: string
}

export async function cancelShopOrderQuery(
  shopOrderId: string,
  input: CancelShopOrderInput = {},
): Promise<ShopOrderDetail> {
  const cancelled = await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!record) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const currentStatus = record.status as OrderStatus
    if (currentStatus === 'cancelled') {
      const order = await getShopOrderQuery(shopOrderId, tx)
      if (!order) {
        throw new Response(
          JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return order
    }

    if (!isValidStatusTransition(currentStatus, 'cancelled')) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Cannot cancel a shop order in status '${currentStatus}'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Pending-payment cancellations must void the Mollie payment so a late
    // webhook cannot capture funds against a cancelled order (P0-14).
    if (currentStatus === 'pending_payment') {
      const [platformOrderRecord] = await tx
        .select({ molliePaymentId: platformOrder.molliePaymentId })
        .from(platformOrder)
        .where(eq(platformOrder.id, record.platformOrderId))
        .limit(1)

      if (platformOrderRecord?.molliePaymentId) {
        try {
          await molliePaymentProvider.cancelPayment(platformOrderRecord.molliePaymentId)
        } catch (cancelErr) {
          const message = cancelErr instanceof Error ? cancelErr.message : ''
          if (
            message.includes('already been captured') ||
            message.includes('Payment has already been captured')
          ) {
            // The buyer completed payment before we could cancel. Refund them
            // immediately and mark the shop order as refunded instead.
            const refundCents =
              record.subtotalCents + record.shippingCostCents - record.refundedCents
            if (refundCents > 0) {
              const reversalOptions = await reversePayoutForRefund(
                tx,
                shopOrderId,
                refundCents,
                'order_cancelled_after_capture',
              )

              await molliePaymentProvider.refundPayment(
                platformOrderRecord.molliePaymentId,
                refundCents,
                reversalOptions,
              )
            }

            await tx
              .update(shopOrder)
              .set({
                status: 'refunded',
                refundedCents: record.subtotalCents + record.shippingCostCents,
                updatedAt: new Date(),
              })
              .where(eq(shopOrder.id, shopOrderId))

            await tx
              .update(platformOrder)
              .set({
                refundedCents: sql`${platformOrder.refundedCents} + ${refundCents}`,
                updatedAt: new Date(),
              })
              .where(eq(platformOrder.id, record.platformOrderId))

            await restoreShopOrderStockInTx(tx, record.platformOrderId, shopOrderId)
            await createInvoicesForPlatformOrder(record.platformOrderId, tx)
            await createCreditNoteForShopOrder(shopOrderId, tx)
            await recalcPlatformOrderStatus(tx, record.platformOrderId)

            logger.error(
              `Cancelled pending_payment shop order ${shopOrderId} was already captured; refunded buyer`,
              undefined,
              {
                alert: true,
                shopOrderId,
                platformOrderId: record.platformOrderId,
                refundCents,
              },
            )

            const order = await getShopOrderQuery(shopOrderId, tx)
            if (!order) {
              throw new Response(
                JSON.stringify({
                  error: 'Not Found',
                  message: 'Shop order not found after update',
                }),
                { status: 404, headers: { 'Content-Type': 'application/json' } },
              )
            }
            return order
          }

          throw cancelErr
        }
      }
    }

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(shopOrder.id, shopOrderId))

    await restoreShopOrderStockInTx(tx, record.platformOrderId, shopOrderId)

    // Reverse any pending payout that may have been created prematurely.
    const [payoutRecord] = await tx
      .select()
      .from(payout)
      .where(eq(payout.shopOrderId, shopOrderId))
      .limit(1)

    if (payoutRecord && ['pending', 'in_transit'].includes(payoutRecord.status)) {
      await tx
        .update(payout)
        .set({ status: 'reversed', reversedAt: new Date(), reversalReason: 'order_cancelled' })
        .where(eq(payout.id, payoutRecord.id))
    }

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const order = await getShopOrderQuery(shopOrderId, tx)
    if (!order) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return order
  })

  logOrderCancelled({
    platformOrderId: cancelled.platformOrderId,
    reason: input.reason,
  })

  return cancelled
}

/* -------------------------------------------------------------------------- */
/*                          Tracking Info Updates                             */
/* -------------------------------------------------------------------------- */

export interface UpdateShopOrderTrackingInput {
  trackingNumber?: string | null
  trackingUrl?: string | null
}

export async function updateShopOrderTrackingQuery(
  shopOrderId: string,
  input: UpdateShopOrderTrackingInput,
): Promise<ShopOrderDetail> {
  const validatedTrackingUrl = validateTrackingUrl(input.trackingUrl)
  const sanitizedTrackingNumber =
    input.trackingNumber === null || input.trackingNumber === undefined
      ? input.trackingNumber
      : input.trackingNumber
        ? validatePlainText(input.trackingNumber, 'Tracking number')
        : input.trackingNumber

  const updated = await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!record) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (record.status !== 'shipped') {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Tracking information can only be updated for shipped orders',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const historyEntry = {
      updatedAt: new Date().toISOString(),
      trackingNumber: sanitizedTrackingNumber ?? record.trackingNumber ?? null,
      trackingUrl: validatedTrackingUrl ?? record.trackingUrl ?? null,
    }

    await tx
      .update(shopOrder)
      .set({
        trackingNumber: sanitizedTrackingNumber,
        trackingUrl: validatedTrackingUrl,
        trackingHistory: sql`${shopOrder.trackingHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, shopOrderId))

    const order = await getShopOrderQuery(shopOrderId, tx)
    if (!order) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return order
  })

  logOrderTrackingUpdated({
    shopOrderId,
    platformOrderId: updated.platformOrderId,
    trackingNumber: updated.trackingNumber,
    trackingUrl: updated.trackingUrl,
  })

  return updated
}

/* -------------------------------------------------------------------------- */
/*                          Manual Review Resolution                          */
/* -------------------------------------------------------------------------- */

export interface ResolveManualReviewInput {
  resolution: 'paid' | 'cancelled'
  reason?: string
}

export async function resolveManualReviewQuery(
  shopOrderId: string,
  input: ResolveManualReviewInput,
): Promise<ShopOrderDetail> {
  const resolved = await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrderId))
      .for('update')
      .limit(1)

    if (!record) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const currentStatus = record.status as OrderStatus
    if (!isValidStatusTransition(currentStatus, input.resolution)) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Cannot resolve manual review from '${currentStatus}' to '${input.resolution}'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (input.resolution === 'paid') {
      // Verify stock availability before resolving to paid. Manual-review orders
      // may have been held for minutes or hours; inventory could have changed.
      const items = await tx
        .select({
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          quantity: orderItem.quantity,
        })
        .from(orderItem)
        .where(eq(orderItem.shopOrderId, shopOrderId))

      const aggregates = new Map<
        string,
        { productId: string; variantId: string | null; quantity: number }
      >()
      for (const item of items) {
        const key = `${item.productId}:${item.variantId ?? ''}`
        const existing = aggregates.get(key)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          aggregates.set(key, {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })
        }
      }

      for (const entry of aggregates.values()) {
        if (entry.variantId) {
          const [variantRow] = await tx
            .select()
            .from(productVariant)
            .where(eq(productVariant.id, entry.variantId))
            .for('update')

          if (!variantRow || entry.quantity > variantRow.stockCount) {
            throw new Response(
              JSON.stringify({
                error: 'Conflict',
                code: 'OUT_OF_STOCK',
                message: 'One or more items are no longer available.',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            )
          }
        } else {
          const [productRow] = await tx
            .select()
            .from(product)
            .where(eq(product.id, entry.productId))
            .for('update')

          if (!productRow) {
            throw new Response(
              JSON.stringify({
                error: 'Conflict',
                code: 'OUT_OF_STOCK',
                message: 'One or more items are no longer available.',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const [reservationResult] = await tx
            .select({ totalReserved: sum(inventoryReservation.quantity) })
            .from(inventoryReservation)
            .where(
              and(
                eq(inventoryReservation.productId, entry.productId),
                gte(inventoryReservation.expiresAt, sql`now()`),
                // Exclude this order's own reservation so an order for the last
                // unit does not appear unavailable to itself.
                or(
                  isNull(inventoryReservation.platformOrderId),
                  ne(inventoryReservation.platformOrderId, record.platformOrderId),
                ),
              ),
            )

          const totalReserved = Number(reservationResult?.totalReserved ?? 0)
          const availableQuantity = productRow.stockCount - totalReserved
          if (entry.quantity > availableQuantity) {
            throw new Response(
              JSON.stringify({
                error: 'Conflict',
                code: 'OUT_OF_STOCK',
                message: 'One or more items are no longer available.',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            )
          }
        }
      }

      await tx
        .update(shopOrder)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(eq(shopOrder.id, shopOrderId))

      const [platformRecord] = await tx
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, record.platformOrderId))
        .limit(1)

      if (platformRecord?.status === 'paid') {
        const { decrementStockForPaidOrder } = await import('./inventory.server')
        await decrementStockForPaidOrder(tx, record.platformOrderId)
      }
    } else if (input.resolution === 'cancelled') {
      // A manual-review order has already been paid by the buyer. Cancelling it
      // must refund the buyer before we release stock (P0-1).
      const [platformOrderRecord] = await tx
        .select({ molliePaymentId: platformOrder.molliePaymentId })
        .from(platformOrder)
        .where(eq(platformOrder.id, record.platformOrderId))
        .limit(1)

      if (!platformOrderRecord?.molliePaymentId) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Gateway',
            message: 'Parent payment is not available for refund',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const refundCents = record.subtotalCents + record.shippingCostCents - record.refundedCents
      const reversalOptions = await reversePayoutForRefund(
        tx,
        shopOrderId,
        refundCents,
        'manual_review_cancelled',
      )

      try {
        await molliePaymentProvider.refundPayment(
          platformOrderRecord.molliePaymentId,
          refundCents,
          reversalOptions,
        )
      } catch (err) {
        logger.error(`Mollie refund failed for manual review cancellation ${shopOrderId}`, err, {
          alert: true,
          shopOrderId,
          molliePaymentId: platformOrderRecord.molliePaymentId,
          refundCents,
        })
        throw new Response(
          JSON.stringify({
            error: 'Bad Gateway',
            message: 'Mollie refund failed. The order has not been cancelled.',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        )
      }

      await tx
        .update(shopOrder)
        .set({
          status: 'cancelled',
          refundedCents: record.subtotalCents + record.shippingCostCents,
          updatedAt: new Date(),
        })
        .where(eq(shopOrder.id, shopOrderId))

      await tx
        .update(platformOrder)
        .set({
          refundedCents: sql`${platformOrder.refundedCents} + ${refundCents}`,
          updatedAt: new Date(),
        })
        .where(eq(platformOrder.id, record.platformOrderId))

      await restoreShopOrderStockInTx(tx, record.platformOrderId, shopOrderId)
      await createCreditNoteForShopOrder(shopOrderId, tx)
    }

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const order = await getShopOrderQuery(shopOrderId, tx)
    if (!order) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return order
  })

  logManualReviewResolved({
    shopOrderId,
    platformOrderId: resolved.platformOrderId,
    resolution: input.resolution,
    reason: input.reason,
  })

  return resolved
}

/* -------------------------------------------------------------------------- */
/*                          Webhook safety helpers                            */
/* -------------------------------------------------------------------------- */

/**
 * Refunds a platform order that was already marked cancelled when a late
 * Mollie `paid` webhook arrives. This is a safety net for the cancellation/
 * payment race described in P0-14.
 *
 * Returns the total amount refunded in cents.
 */
export async function refundCancelledPlatformOrder(
  platformOrderId: string,
  molliePaymentId: string,
  provider: PaymentProvider = molliePaymentProvider,
): Promise<number> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: platformOrder.id, status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderId))
      .for('update')
      .limit(1)

    if (!order || order.status !== 'cancelled') {
      return 0
    }

    const shopOrders = await tx
      .select({
        id: shopOrder.id,
        subtotalCents: shopOrder.subtotalCents,
        shippingCostCents: shopOrder.shippingCostCents,
        refundedCents: shopOrder.refundedCents,
        platformOrderId: shopOrder.platformOrderId,
      })
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, platformOrderId))
      .for('update')

    let totalRefunded = 0

    for (const so of shopOrders) {
      const refundCents = Math.max(0, so.subtotalCents + so.shippingCostCents - so.refundedCents)
      if (refundCents === 0) continue

      const reversalOptions = await reversePayoutForRefund(
        tx,
        so.id,
        refundCents,
        'cancelled_order_paid_webhook',
      )

      await provider.refundPayment(molliePaymentId, refundCents, reversalOptions)

      await tx
        .update(shopOrder)
        .set({
          status: 'refunded',
          refundedCents: so.refundedCents + refundCents,
          updatedAt: new Date(),
        })
        .where(eq(shopOrder.id, so.id))

      await restoreShopOrderStockInTx(tx, so.platformOrderId, so.id)
      await createCreditNoteForShopOrder(so.id, tx)

      totalRefunded += refundCents
    }

    if (totalRefunded > 0) {
      await tx
        .update(platformOrder)
        .set({
          refundedCents: sql`${platformOrder.refundedCents} + ${totalRefunded}`,
          updatedAt: new Date(),
        })
        .where(eq(platformOrder.id, platformOrderId))
    }

    await recalcPlatformOrderStatus(tx, platformOrderId)
    return totalRefunded
  })

  if (result > 0) {
    logger.error('Refunded cancelled platform order after late paid webhook', undefined, {
      alert: true,
      platformOrderId,
      molliePaymentId,
      refundCents: result,
    })
  }

  return result
}
