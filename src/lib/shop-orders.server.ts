import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import {
  dispute,
  orderItem,
  platformOrder,
  shippingLabel,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { mondialRelayProvider } from '#/integrations/shipping'
import type { ShippingAddress } from './checkout.server'
import { getBaseUrl } from './env.server'
import { logOrderDelivered, logOrderShipped } from './order-logger'
import type { OrderStatus } from './orders.server'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const maskedLocal = local.length > 1 ? local[0] + '***' : '***'
  return `${maskedLocal}@${domain}`
}

export interface ShopOrderItemDetail {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
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
  shippingCostCents: number
  subtotalCents: number
  trackingNumber: string | null
  trackingUrl: string | null
  createdAt: Date
  updatedAt: Date
  buyer: ShopOrderBuyer
  shippingAddress: ShippingAddress
  items: ShopOrderItemDetail[]
  label: ShippingLabelDetail | null
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
  paid: ['processing', 'shipped', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'disputed', 'cancelled', 'refunded'],
  delivered: ['completed', 'disputed', 'cancelled', 'refunded'],
  completed: ['cancelled', 'refunded'],
  cancelled: [],
  refunded: [],
  disputed: ['cancelled', 'refunded', 'completed'],
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

  // Priority checks
  if (shopOrderStatuses.some((s) => s === 'disputed')) return 'disputed'
  if (shopOrderStatuses.every((s) => s === 'refunded')) return 'refunded'
  if (shopOrderStatuses.every((s) => s === 'cancelled')) return 'cancelled'
  if (shopOrderStatuses.some((s) => s === 'pending_payment')) return 'pending_payment'
  if (shopOrderStatuses.every((s) => s === 'completed')) return 'completed'
  if (shopOrderStatuses.every((s) => s === 'delivered' || s === 'completed')) return 'delivered'
  if (shopOrderStatuses.every((s) => ['shipped', 'delivered', 'completed'].includes(s)))
    return 'shipped'
  if (
    shopOrderStatuses.some((s) => s === 'processing') &&
    !shopOrderStatuses.some((s) => s === 'pending_payment')
  ) {
    return 'processing'
  }
  if (
    shopOrderStatuses.every((s) =>
      ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(s),
    )
  ) {
    return 'paid'
  }

  // Fallback for mixed edge cases
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
  const [shopOrderRecord] = await tx
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)

  if (!shopOrderRecord) {
    return null
  }

  const [platformOrderRecord] = await tx
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, shopOrderRecord.platformOrderId))
    .limit(1)

  if (!platformOrderRecord) {
    return null
  }

  const [buyerRecord] = await tx
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, platformOrderRecord.userId))
    .limit(1)

  const items = await tx
    .select({
      id: orderItem.id,
      productId: orderItem.productId,
      productName: orderItem.productName,
      unitPriceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
      totalCents: orderItem.totalCents,
    })
    .from(orderItem)
    .where(eq(orderItem.shopOrderId, shopOrderId))

  const [labelRecord] = await tx
    .select({
      id: shippingLabel.id,
      carrier: shippingLabel.carrier,
      trackingNumber: shippingLabel.trackingNumber,
      labelUrl: shippingLabel.labelUrl,
      createdAt: shippingLabel.createdAt,
    })
    .from(shippingLabel)
    .where(eq(shippingLabel.shopOrderId, shopOrderId))
    .limit(1)

  return {
    id: shopOrderRecord.id,
    platformOrderId: shopOrderRecord.platformOrderId,
    shopId: shopOrderRecord.shopId,
    status: shopOrderRecord.status,
    shippingMethod: shopOrderRecord.shippingMethod,
    shippingCostCents: shopOrderRecord.shippingCostCents,
    subtotalCents: shopOrderRecord.subtotalCents,
    trackingNumber: shopOrderRecord.trackingNumber,
    trackingUrl: shopOrderRecord.trackingUrl,
    createdAt: shopOrderRecord.createdAt,
    updatedAt: shopOrderRecord.updatedAt,
    buyer: buyerRecord ?? { id: platformOrderRecord.userId, name: 'Unknown', email: '' },
    shippingAddress: platformOrderRecord.shippingAddress as ShippingAddress,
    items,
    label: labelRecord ?? null,
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
  if (input.trackingUrl) {
    const urlResult = z.string().url().safeParse(input.trackingUrl)
    if (!urlResult.success) {
      throw new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid tracking URL format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // Fetch current status before transaction to know if this is a real transition
  const [preRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)

  const wasAlreadyShipped = preRecord?.status === 'shipped'

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.select().from(shopOrder).where(eq(shopOrder.id, shopOrderId)).limit(1)

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
      }
      if (input.trackingUrl !== undefined) {
        updateData.trackingUrl = input.trackingUrl
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
      return updated
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
    }
    if (input.trackingUrl !== undefined) {
      updateData.trackingUrl = input.trackingUrl
    }

    await tx.update(shopOrder).set(updateData).where(eq(shopOrder.id, shopOrderId))

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return updated
  })

  // Notify buyer after the transaction so errors don't break the shipment update
  // Only notify on actual status transition, not idempotent tracking updates
  if (!wasAlreadyShipped && result.status === 'shipped') {
    try {
      const { createNotification, sendNotificationEmail } = await import('./notifications.server')
      const order = await getShopOrderQuery(shopOrderId)
      if (order) {
        await createNotification(order.buyer.id, 'order_shipped', {
          platformOrderId: order.platformOrderId,
          shopOrderId,
        })

        const [shopRecord] = await db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1)
        await sendNotificationEmail(order.buyer.id, 'shipping_notification', {
          orderNumber: shopOrderId.slice(0, 8),
          buyerName: order.buyer.name,
          shopName: shopRecord?.name ?? 'Eurtisan',
          trackingNumber: order.trackingNumber ?? undefined,
          carrier: 'Mondial Relay',
          trackingUrl: order.trackingUrl ?? undefined,
        })
      }
    } catch {
      // Notification/email errors must not break the primary business transaction
    }
  }

  if (!wasAlreadyShipped && result.status === 'shipped') {
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

  // Build a sensible package estimate from order item count
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const weightGrams = Math.max(100, itemCount * 250)
  const lengthCm = Math.max(10, itemCount * 5)
  const widthCm = Math.max(10, itemCount * 4)
  const heightCm = Math.max(5, itemCount * 3)

  try {
    const label = await mondialRelayProvider.createLabel({
      origin,
      destination,
      package: { weightGrams, lengthCm, widthCm, heightCm },
      carrierService: order.shippingMethod === 'express' ? 'mondial_xpr' : 'mondial_std',
      reference: shopOrderId,
    })

    // Insert shipping_label row (provider may also insert, but we ensure it here)
    const [record] = await db
      .insert(shippingLabel)
      .values({
        shopOrderId,
        carrier: label.carrier,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
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
  const [preRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)

  const wasAlreadyDelivered = preRecord?.status === 'delivered'

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.select().from(shopOrder).where(eq(shopOrder.id, shopOrderId)).limit(1)

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
      return order
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

    await tx
      .update(shopOrder)
      .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(shopOrder.id, shopOrderId))

    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return updated
  })

  if (!wasAlreadyDelivered && result.status === 'delivered') {
    logOrderDelivered({
      shopOrderId,
      platformOrderId: result.platformOrderId,
    })
  }

  return result
}

export async function updateShopOrderStatusQuery(
  shopOrderId: string,
  input: UpdateShopOrderStatusInput,
): Promise<ShopOrderDetail> {
  const result = await db.transaction(async (tx) => {
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
      }
      if (input.trackingUrl !== undefined) {
        updateData.trackingUrl = input.trackingUrl
      }
    }

    await tx.update(shopOrder).set(updateData).where(eq(shopOrder.id, shopOrderId))

    // Recalculate parent platform order status
    await recalcPlatformOrderStatus(tx, record.platformOrderId)

    const updated = await getShopOrderQuery(shopOrderId, tx)
    if (!updated) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop order not found after update' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return updated
  })

  // Notify buyer when a dispute is opened
  if (input.status === 'disputed') {
    try {
      const { createNotification, sendNotificationEmail } = await import('./notifications.server')
      const order = await getShopOrderQuery(shopOrderId)
      if (order) {
        await createNotification(order.buyer.id, 'dispute_opened', {
          platformOrderId: order.platformOrderId,
          shopOrderId,
        })

        const [disputeRecord] = await db
          .select()
          .from(dispute)
          .where(eq(dispute.shopOrderId, shopOrderId))
          .limit(1)

        const [shopRecord] = await db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1)

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
    } catch {
      // Notification/email errors must not break the primary business transaction
    }
  }

  return result
}
