import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shippingLabel, shop, shopOrder, user } from '#/db/schema'
import { decryptJsonb } from '../encryption.server'
import type { BillingAddress } from '../invoices/types'
import type { ShippingAddress } from '../checkout.server'
import type { OrderShopGroup, OrderStatus } from '../orders.server'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminOrderListItem {
  id: string
  orderNumber: string
  buyerName: string
  buyerEmail: string
  totalCents: number
  status: OrderStatus
  shopCount: number
  createdAt: Date
}

export interface AdminOrderDetail {
  id: string
  orderNumber: string
  buyerName: string
  buyerEmail: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
  cancelledAt: Date | null
  cancellationReason: string | null
  shippingAddress: ShippingAddress
  billingAddress: BillingAddress
  molliePaymentId: string | null
  shops: OrderShopGroup[]
}

export interface PaginatedAdminOrders {
  orders: AdminOrderListItem[]
  total: number
  page: number
  pageSize: number
}

/* -------------------------------------------------------------------------- */
/*                            List All Platform Orders                        */
/* -------------------------------------------------------------------------- */

/**
 * Returns a paginated, searchable list of all platform orders across the entire platform.
 * Search matches against platform order ID (UUID) or buyer name/email.
 */
export async function listAllPlatformOrdersQuery(
  query: string | undefined,
  page: number,
  pageSize: number,
  from?: Date,
  to?: Date,
  statuses?: string[],
): Promise<PaginatedAdminOrders> {
  const offset = (page - 1) * pageSize

  const conditions = []

  if (query) {
    conditions.push(
      or(
        ilike(platformOrder.orderNumber, `%${query}%`),
        ilike(sql`${platformOrder.id}::text`, `%${query}%`),
        ilike(user.name, `%${query}%`),
        ilike(user.email, `%${query}%`),
      ),
    )
  }

  if (from) {
    conditions.push(gte(platformOrder.createdAt, from))
  }
  if (to) {
    conditions.push(lte(platformOrder.createdAt, to))
  }
  if (statuses && statuses.length > 0) {
    conditions.push(
      inArray(
        platformOrder.status,
        statuses as (
          | 'pending_payment'
          | 'paid'
          | 'processing'
          | 'shipped'
          | 'delivered'
          | 'completed'
          | 'cancelled'
          | 'refunded'
          | 'disputed'
        )[],
      ),
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const baseQuery = db
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      buyerName: user.name,
      buyerEmail: user.email,
      totalCents: platformOrder.totalCents,
      status: platformOrder.status,
      createdAt: platformOrder.createdAt,
    })
    .from(platformOrder)
    .leftJoin(user, eq(platformOrder.userId, user.id))
    .where(whereClause)
    .orderBy(desc(platformOrder.createdAt))
    .$dynamic()

  // Get total count with same filters
  const [[{ count: totalCount }], ordersResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(platformOrder)
      .leftJoin(user, eq(platformOrder.userId, user.id))
      .where(whereClause),
    baseQuery.limit(pageSize).offset(offset),
  ])

  if (ordersResult.length === 0) {
    return { orders: [], total: Number(totalCount), page, pageSize }
  }

  // Get shop counts per order in a single query
  const orderIds = ordersResult.map((o) => o.id)
  const shopCounts = await db
    .select({
      platformOrderId: shopOrder.platformOrderId,
      count: count(),
    })
    .from(shopOrder)
    .where(inArray(shopOrder.platformOrderId, orderIds))
    .groupBy(shopOrder.platformOrderId)

  const shopCountMap = new Map<string, number>()
  for (const sc of shopCounts) {
    if (sc.platformOrderId) {
      shopCountMap.set(sc.platformOrderId, Number(sc.count))
    }
  }

  const orders: AdminOrderListItem[] = ordersResult.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    buyerName: o.buyerName ?? 'Unknown',
    buyerEmail: o.buyerEmail ?? 'Unknown',
    totalCents: o.totalCents,
    status: o.status as OrderStatus,
    shopCount: shopCountMap.get(o.id) ?? 0,
    createdAt: o.createdAt,
  }))

  return { orders, total: Number(totalCount), page, pageSize }
}

/* -------------------------------------------------------------------------- */
/*                       Get Platform Order Detail (Admin)                    */
/* -------------------------------------------------------------------------- */

/**
 * Returns the full order tree for a given platform order.
 * Admin-only — no ownership check is performed here; authorization is handled upstream.
 */
export async function getPlatformOrderDetailQuery(
  platformOrderId: string,
): Promise<AdminOrderDetail | null> {
  const [order] = await db
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      buyerName: user.name,
      buyerEmail: user.email,
      totalCents: platformOrder.totalCents,
      status: platformOrder.status,
      createdAt: platformOrder.createdAt,
      cancelledAt: platformOrder.cancelledAt,
      cancellationReason: platformOrder.cancellationReason,
      shippingAddress: platformOrder.shippingAddress,
      billingAddress: platformOrder.billingAddress,
      molliePaymentId: platformOrder.molliePaymentId,
    })
    .from(platformOrder)
    .leftJoin(user, eq(platformOrder.userId, user.id))
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (!order) {
    return null
  }

  const shopOrdersResult = await db
    .select({
      shopOrder: shopOrder,
      shop: shop,
    })
    .from(shopOrder)
    .leftJoin(shop, eq(shopOrder.shopId, shop.id))
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  const shopOrderIds = shopOrdersResult.map((so) => so.shopOrder.id)

  const itemsResult =
    shopOrderIds.length > 0
      ? await db.select().from(orderItem).where(inArray(orderItem.shopOrderId, shopOrderIds))
      : []

  const labelsResult =
    shopOrderIds.length > 0
      ? await db
          .select()
          .from(shippingLabel)
          .where(inArray(shippingLabel.shopOrderId, shopOrderIds))
      : []

  const itemsByShopOrderId = new Map<string, typeof itemsResult>()
  for (const item of itemsResult) {
    const list = itemsByShopOrderId.get(item.shopOrderId) ?? []
    list.push(item)
    itemsByShopOrderId.set(item.shopOrderId, list)
  }

  const labelsByShopOrderId = new Map<string, typeof labelsResult>()
  for (const label of labelsResult) {
    const list = labelsByShopOrderId.get(label.shopOrderId) ?? []
    list.push(label)
    labelsByShopOrderId.set(label.shopOrderId, list)
  }

  const shops: OrderShopGroup[] = shopOrdersResult.map((so) => {
    const labels = labelsByShopOrderId.get(so.shopOrder.id) ?? []
    return {
      shopOrderId: so.shopOrder.id,
      shopId: so.shopOrder.shopId,
      shopName: so.shop?.name ?? 'Unknown shop',
      shippingMethod: so.shopOrder.shippingMethod as 'standard' | 'express' | 'manual',
      shippingRateId: so.shopOrder.shippingRateId ?? null,
      shippingCostCents: so.shopOrder.shippingCostCents,
      subtotalCents: so.shopOrder.subtotalCents,
      vatAmountCents: so.shopOrder.vatAmountCents,
      shippingVatRateBasisPoints: so.shopOrder.shippingVatRateBasisPoints,
      shippingVatAmountCents: so.shopOrder.shippingVatAmountCents,
      status: so.shopOrder.status as OrderStatus,
      trackingNumber: so.shopOrder.trackingNumber,
      trackingUrl: so.shopOrder.trackingUrl,
      deliveredAt: so.shopOrder.deliveredAt,
      shippingLabels: labels.map((label) => ({
        carrier: label.carrier,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        createdAt: label.createdAt,
      })),
      trackingStatus: null,
      invoiceNumber: null,
      disputeId: null,
      items: (itemsByShopOrderId.get(so.shopOrder.id) ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
        vatRateBasisPoints: item.vatRateBasisPoints,
        vatAmountCents: item.vatAmountCents,
      })),
    }
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    buyerName: order.buyerName ?? 'Unknown',
    buyerEmail: order.buyerEmail ?? 'Unknown',
    totalCents: order.totalCents,
    status: order.status as OrderStatus,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    // Both columns are encrypted at rest on every write path (see
    // checkout/order-persistence). Read raw, they come back as ciphertext
    // envelopes and the admin detail page renders blank addresses. Legacy
    // plaintext rows pass through untouched.
    shippingAddress: decryptJsonb<ShippingAddress>(order.shippingAddress),
    billingAddress: decryptJsonb<BillingAddress>(order.billingAddress ?? {}),
    molliePaymentId: order.molliePaymentId,
    shops,
  }
}
