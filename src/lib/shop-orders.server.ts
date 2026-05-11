import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shopOrder, user } from '#/db/schema'
import type { ShippingAddress } from './checkout.server'
import type { OrderStatus } from './orders.server'

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

export interface ShopOrderDetail {
  id: string
  platformOrderId: string
  shopId: string
  status: string
  shippingMethod: 'standard' | 'express'
  shippingCostCents: number
  subtotalCents: number
  trackingNumber: string | null
  trackingUrl: string | null
  createdAt: Date
  updatedAt: Date
  buyer: ShopOrderBuyer
  shippingAddress: ShippingAddress
  items: ShopOrderItemDetail[]
}

export interface ShopOrderListItem {
  id: string
  platformOrderId: string
  status: string
  shippingMethod: 'standard' | 'express'
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
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'disputed', 'cancelled', 'refunded'],
  delivered: ['completed', 'disputed', 'cancelled', 'refunded'],
  completed: ['cancelled', 'refunded'],
  cancelled: [],
  refunded: [],
  disputed: ['cancelled', 'refunded'],
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
  }
}

export async function listShopOrdersQuery(
  shopId: string,
  options: {
    status?: string
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

  const where = and(...conditions)

  const [totalResult] = await db.select({ total: count() }).from(shopOrder).where(where)
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

export async function updateShopOrderStatusQuery(
  shopOrderId: string,
  input: UpdateShopOrderStatusInput,
): Promise<ShopOrderDetail> {
  return db.transaction(async (tx) => {
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
}
