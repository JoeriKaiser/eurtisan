import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  dispute,
  orderItem,
  payout,
  platformOrder,
  shippingLabel,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import { molliePaymentProvider } from '#/integrations/mollie'
import { scheduleBackgroundWork } from './background-work.server'
import { restoreShopOrderStockInTx } from './inventory.server'
import { createCreditNoteForShopOrder } from './invoices.server'
import type { ShippingAddress } from './checkout.server'
import { getBaseUrl } from './env.server'
import { logger } from './logger.server'
import { logOrderDelivered, logOrderShipped } from './order-logger'
import type { OrderStatus } from './orders.server'
import { createPayoutForShopOrder, executePayoutQuery } from './payouts.server'
import { calculatePackageFromItems } from './shipping-estimate'
import { validatePlainText, validateTrackingUrl } from './xss'

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
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'shipped', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered', 'disputed', 'refunded'],
  delivered: ['completed', 'disputed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
  disputed: ['refunded', 'completed'],
  manual_review: [],
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

  // 1. If ANY shop order is disputed, the overall status is disputed.
  if (shopOrderStatuses.some((s) => s === 'disputed')) {
    return 'disputed'
  }

  if (shopOrderStatuses.some((s) => s === 'chargeback')) {
    return 'chargeback'
  }

  // 2. Filter out cancelled and refunded statuses for active resolution derivation.
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
    shippingAddress: header.shippingAddress as ShippingAddress,
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
    conditions.push(
      or(
        ilike(user.name, searchTerm),
        ilike(sql<string>`CAST(${shopOrder.id} AS TEXT)`, searchTerm),
      )!,
    )
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
    .groupBy(shopOrder.id, user.name, user.email)
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
          await sendNotificationEmail(order.buyer.id, 'shipping_notification', {
            orderNumber: shopOrderId.slice(0, 8),
            buyerName: order.buyer.name,
            shopName: shopRecord?.name ?? 'Eurtisan',
            trackingNumber: order.trackingNumber ?? null,
            carrier: latestLabel?.carrier ?? 'Sendcloud',
            trackingUrl: order.trackingUrl ?? null,
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
  const {
    shopOrder: updatedShopOrder,
    didTransition,
    payoutId,
  } = await db.transaction(async (tx) => {
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

    // Sequential within transaction: recalc depends on the update, and getShopOrderQuery
    // reads the updated state.
    await tx
      .update(shopOrder)
      .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(shopOrder.id, shopOrderId))

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const payoutId = await createPayoutForShopOrder(
      tx,
      shopOrderId,
      record.shopId,
      record.subtotalCents,
      record.vatAmountCents,
      record.shippingCostCents,
      record.shippingMethod as 'standard' | 'express' | 'manual',
    )

    // Trigger DAC7 threshold warnings if the creator lacks a Tax ID
    try {
      const { getDac7ComplianceStatus } = await import('./dac7.server')
      const currentYear = new Date().getFullYear()
      const dac7Status = await getDac7ComplianceStatus(record.shopId, currentYear)

      if (dac7Status.approachingLimit || dac7Status.exceededLimit) {
        const [shopRecord] = await tx
          .select({ ownerId: shop.ownerId, taxId: shop.taxId, name: shop.name })
          .from(shop)
          .where(eq(shop.id, record.shopId))
          .limit(1)

        if (shopRecord && !shopRecord.taxId) {
          const { createNotification } = await import('./notifications.server')
          await createNotification(shopRecord.ownerId, 'dac7_warning_limit', {
            shopId: record.shopId,
            shopName: shopRecord.name,
            transactionCount: dac7Status.transactionCount,
            grossSalesCents: dac7Status.grossSalesCents,
            limitType: dac7Status.exceededLimit ? 'exceeded' : 'approaching',
          })
        }
      }
    } catch (err) {
      console.error('Failed to trigger DAC7 compliance warning:', err)
    }

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return { shopOrder: updated, didTransition: true, payoutId }
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

    if (payoutId) {
      scheduleBackgroundWork(`execute-payout-${payoutId}`, async () => {
        try {
          await executePayoutQuery(payoutId)
        } catch (err) {
          logger.error(`Auto payout execution failed for ${payoutId}`, err, {
            alert: true,
            shopOrderId,
            payoutId,
          })
        }
      })
    }
  }

  return updatedShopOrder
}

export async function updateShopOrderStatusQuery(
  shopOrderId: string,
  input: UpdateShopOrderStatusInput,
): Promise<ShopOrderDetail> {
  const validatedTrackingUrl = validateTrackingUrl(input.trackingUrl)

  const { updated: updatedShopOrder, payoutId } = await db.transaction(async (tx) => {
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

    let payoutId: string | undefined
    if (nextStatus === 'delivered' || nextStatus === 'completed') {
      payoutId = await createPayoutForShopOrder(
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

    return { updated, payoutId }
  })

  if ((input.status === 'delivered' || input.status === 'completed') && payoutId) {
    scheduleBackgroundWork(`execute-payout-${payoutId}`, async () => {
      try {
        await executePayoutQuery(payoutId)
      } catch (err) {
        logger.error(`Auto payout execution failed for ${payoutId}`, err, {
          alert: true,
          shopOrderId,
          payoutId,
        })
      }
    })
  }

  // Notify buyer when a dispute is opened
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
              shopOrderId,
            }),
            db.select().from(dispute).where(eq(dispute.shopOrderId, shopOrderId)).limit(1),
            db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1),
          ])

          const baseUrl = getBaseUrl()
          await sendNotificationEmail(order.buyer.id, 'dispute_update', {
            orderNumber: shopOrderId.slice(0, 8),
            buyerName: order.buyer.name,
            shopName: shopRecord?.name ?? 'Eurtisan',
            status: 'opened',
            disputeUrl: disputeRecord
              ? `${baseUrl}/disputes/${disputeRecord.id}`
              : `${baseUrl}/orders/${order.platformOrderId}`,
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
 * Issues a full refund for a shop order on behalf of the shop owner.
 *
 * - Authorizes the caller as the shop owner.
 * - Calls Mollie to refund the parent payment.
 * - Reverses any already-routed payout.
 * - Releases inventory reservations.
 * - Marks the shop order and platform order as refunded.
 * - Creates a credit note linked to the original customer invoice.
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
      refundedCents: shopOrder.refundedCents,
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

  const [platformOrderRecord] = await db
    .select({ molliePaymentId: platformOrder.molliePaymentId })
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

  const refundCents = orderRecord.subtotalCents - orderRecord.refundedCents
  if (refundCents <= 0) {
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'Order has already been fully refunded' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Reverse any already-routed payout.
  const [payoutRecord] = await db
    .select()
    .from(payout)
    .where(eq(payout.shopOrderId, shopOrderId))
    .limit(1)

  let reverseRouting = false
  let routingReversals: Array<{ organizationId: string; amountCents: number }> | undefined

  if (payoutRecord?.status === 'sent' || payoutRecord?.status === 'in_transit') {
    const [shopRecord] = await db
      .select({ mollieAccountId: shop.mollieAccountId })
      .from(shop)
      .where(eq(shop.id, orderRecord.shopId))
      .limit(1)

    if (shopRecord?.mollieAccountId) {
      if (refundCents >= payoutRecord.amountCents) {
        reverseRouting = true
      } else {
        routingReversals = [
          {
            organizationId: shopRecord.mollieAccountId,
            amountCents: Math.min(refundCents, payoutRecord.amountCents),
          },
        ]
      }
    }
  }

  try {
    await molliePaymentProvider.refundPayment(platformOrderRecord.molliePaymentId, refundCents, {
      ...(reverseRouting ? { reverseRouting: true } : {}),
      ...(routingReversals ? { routingReversals } : {}),
    })
  } catch (err) {
    logger.error(`Mollie refund failed for shop order ${shopOrderId}`, err, {
      alert: true,
      shopOrderId,
      molliePaymentId: platformOrderRecord.molliePaymentId,
      refundCents,
    })
    throw new Response(JSON.stringify({ error: 'Bad Gateway', message: 'Mollie refund failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const creditNoteNumber = await db.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({
        id: shopOrder.id,
        status: shopOrder.status,
        refundedCents: shopOrder.refundedCents,
        subtotalCents: shopOrder.subtotalCents,
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
      lockedOrder.refundedCents !== orderRecord.refundedCents
    ) {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Refund state changed during processing' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    await tx
      .update(shopOrder)
      .set({
        status: 'refunded',
        refundedCents: lockedOrder.refundedCents + refundCents,
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

    if (payoutRecord?.status === 'sent' || payoutRecord?.status === 'in_transit') {
      await tx
        .update(payout)
        .set({
          status: 'reversed',
          reversedAt: new Date(),
          reversalReason: 'owner_refund',
        })
        .where(eq(payout.id, payoutRecord.id))
    }

    await recalcPlatformOrderStatus(tx, orderRecord.platformOrderId)

    return createCreditNoteForShopOrder(shopOrderId, tx)
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
      await sendNotificationEmail(order.buyer.id, 'order_refunded', {
        orderNumber: shopOrderId.slice(0, 8),
        buyerName: order.buyer.name,
        shopName: shopRecord?.name ?? 'Eurtisan',
        refundAmount: `${(refundCents / 100).toFixed(2)}`,
        orderUrl: `${baseUrl}/orders/${order.platformOrderId}`,
      })
    }
  })

  return { success: true, shopOrderId, creditNoteNumber }
}
