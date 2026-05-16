import { count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shop, shopOrder, user } from '#/db/schema'
import type { ShippingAddress } from './checkout.server'
import type { OrderShopGroup, OrderStatus } from './orders.server'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminOrderListItem {
  id: string
  buyerName: string
  buyerEmail: string
  totalCents: number
  status: OrderStatus
  shopCount: number
  createdAt: Date
}

export interface AdminOrderDetail {
  id: string
  buyerName: string
  buyerEmail: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
  cancelledAt: Date | null
  cancellationReason: string | null
  shippingAddress: ShippingAddress
  billingAddress: Record<string, unknown>
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
): Promise<PaginatedAdminOrders> {
  const offset = (page - 1) * pageSize

  // Build where clause based on optional search query
  const whereClause = query
    ? or(
        ilike(sql`${platformOrder.id}::text`, `%${query}%`),
        ilike(user.name, `%${query}%`),
        ilike(user.email, `%${query}%`),
      )
    : undefined

  const baseQuery = db
    .select({
      id: platformOrder.id,
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
  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(platformOrder)
    .leftJoin(user, eq(platformOrder.userId, user.id))
    .where(whereClause)

  const ordersResult = await baseQuery.limit(pageSize).offset(offset)

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

  const shops: OrderShopGroup[] = shopOrdersResult.map((so) => ({
    shopOrderId: so.shopOrder.id,
    shopId: so.shopOrder.shopId,
    shopName: so.shop?.name ?? 'Unknown shop',
    shippingMethod: so.shopOrder.shippingMethod as 'standard' | 'express',
    shippingCostCents: so.shopOrder.shippingCostCents,
    subtotalCents: so.shopOrder.subtotalCents,
    status: so.shopOrder.status as OrderStatus,
    trackingNumber: so.shopOrder.trackingNumber,
    trackingUrl: so.shopOrder.trackingUrl,
    deliveredAt: so.shopOrder.deliveredAt,
    items: itemsResult
      .filter((item) => item.shopOrderId === so.shopOrder.id)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
      })),
  }))

  return {
    id: order.id,
    buyerName: order.buyerName ?? 'Unknown',
    buyerEmail: order.buyerEmail ?? 'Unknown',
    totalCents: order.totalCents,
    status: order.status as OrderStatus,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    shippingAddress: order.shippingAddress as ShippingAddress,
    billingAddress: (order.billingAddress ?? {}) as Record<string, unknown>,
    molliePaymentId: order.molliePaymentId,
    shops,
  }
}
