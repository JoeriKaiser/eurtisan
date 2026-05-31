import { count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shippingLabel, shop, shopOrder } from '#/db/schema'
import { mondialRelayProvider } from '#/integrations/shipping'
import type { ShippingAddress } from './checkout.server'
import { releaseStockInTx } from './inventory.server'

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'manual_review'

export interface OrderItemDetail {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
}

export interface ShippingLabelInfo {
  carrier: string
  trackingNumber: string | null
  labelUrl: string | null
  createdAt: Date
}

export interface OrderShopGroup {
  shopOrderId: string
  shopId: string
  shopName: string
  shippingMethod: 'standard' | 'express' | 'manual'
  shippingCostCents: number
  subtotalCents: number
  vatAmountCents: number
  shippingVatRateBasisPoints: number
  shippingVatAmountCents: number
  status: OrderStatus
  trackingNumber: string | null
  trackingUrl: string | null
  deliveredAt: Date | null
  shippingLabels: ShippingLabelInfo[]
  trackingStatus: string | null
  items: OrderItemDetail[]
}

export interface OrderDetail {
  id: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
  cancelledAt: Date | null
  cancellationReason: string | null
  shippingAddress: ShippingAddress
  shops: OrderShopGroup[]
}

export interface BuyerOrderShopSummary {
  shopId: string
  shopName: string
  status: OrderStatus
}

export interface BuyerOrderListItem {
  id: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
  shopCount: number
  shopSummary: BuyerOrderShopSummary[]
}

export async function getOrderOwnerId(platformOrderId: string): Promise<string | null> {
  const [order] = await db
    .select({ userId: platformOrder.userId })
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)
  return order?.userId ?? null
}

interface CachedTracking {
  status: string
  cachedAt: number
}

const trackingCache = new Map<string, CachedTracking>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const API_TIMEOUT_MS = 1000 // 1 second

export async function getBuyerOrderDetailQuery(
  platformOrderId: string,
  userId: string,
): Promise<OrderDetail | null> {
  const [order] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (!order || order.userId !== userId) {
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

  const labelsByShopOrderId = new Map<string, typeof labelsResult>()
  for (const label of labelsResult) {
    const list = labelsByShopOrderId.get(label.shopOrderId) ?? []
    list.push(label)
    labelsByShopOrderId.set(label.shopOrderId, list)
  }

  const trackingStatuses = await Promise.all(
    shopOrdersResult.map(async (so) => {
      const labels = labelsByShopOrderId.get(so.shopOrder.id) ?? []
      const label = labels.find((l) => l.trackingNumber)
      if (!label?.trackingNumber) return null

      // Check in-memory cache first
      const cached = trackingCache.get(label.trackingNumber)
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return { shopOrderId: so.shopOrder.id, status: cached.status }
      }

      let timerId: ReturnType<typeof setTimeout> | undefined
      try {
        // Fetch with a 1-second timeout wrapper
        const trackPromise = mondialRelayProvider.trackShipment(label.trackingNumber)
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT_MS)
        })

        const info = await Promise.race([trackPromise, timeoutPromise])

        // Cache the result
        trackingCache.set(label.trackingNumber, {
          status: info.status,
          cachedAt: Date.now(),
        })

        return { shopOrderId: so.shopOrder.id, status: info.status }
      } catch (_err) {
        // If there was a timeout/error, and we have an expired cached value, return it as a fallback
        if (cached) {
          return { shopOrderId: so.shopOrder.id, status: cached.status }
        }
        return null
      } finally {
        if (timerId) {
          clearTimeout(timerId)
        }
      }
    }),
  )

  const trackingStatusMap = new Map(
    trackingStatuses
      .filter((t): t is { shopOrderId: string; status: string } => t !== null)
      .map((t) => [t.shopOrderId, t.status]),
  )

  const itemsByShopOrderId = new Map<string, typeof itemsResult>()
  for (const item of itemsResult) {
    const list = itemsByShopOrderId.get(item.shopOrderId) ?? []
    list.push(item)
    itemsByShopOrderId.set(item.shopOrderId, list)
  }

  const shops: OrderShopGroup[] = shopOrdersResult.map((so) => {
    const labels = labelsByShopOrderId.get(so.shopOrder.id) ?? []
    return {
      shopOrderId: so.shopOrder.id,
      shopId: so.shopOrder.shopId,
      shopName: so.shop?.name ?? 'Unknown shop',
      shippingMethod: so.shopOrder.shippingMethod,
      shippingCostCents: so.shopOrder.shippingCostCents,
      subtotalCents: so.shopOrder.subtotalCents,
      vatAmountCents: so.shopOrder.vatAmountCents,
      shippingVatRateBasisPoints: so.shopOrder.shippingVatRateBasisPoints,
      shippingVatAmountCents: so.shopOrder.shippingVatAmountCents,
      status: so.shopOrder.status,
      trackingNumber: so.shopOrder.trackingNumber,
      trackingUrl: so.shopOrder.trackingUrl,
      deliveredAt: so.shopOrder.deliveredAt,
      shippingLabels: labels.map((label) => ({
        carrier: label.carrier,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        createdAt: label.createdAt,
      })),
      trackingStatus: trackingStatusMap.get(so.shopOrder.id) ?? null,
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
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    shippingAddress: order.shippingAddress as ShippingAddress,
    shops,
  }
}

export async function listBuyerOrdersQuery(
  userId: string,
  limit: number,
  offset: number,
): Promise<{ orders: BuyerOrderListItem[]; total: number }> {
  const [ordersResult, [{ count: totalCount }]] = await Promise.all([
    db
      .select({
        id: platformOrder.id,
        totalCents: platformOrder.totalCents,
        status: platformOrder.status,
        createdAt: platformOrder.createdAt,
      })
      .from(platformOrder)
      .where(eq(platformOrder.userId, userId))
      .orderBy(desc(platformOrder.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(platformOrder).where(eq(platformOrder.userId, userId)),
  ])

  if (ordersResult.length === 0) {
    return { orders: [], total: totalCount }
  }

  const orderIds = ordersResult.map((o) => o.id)

  const shopOrdersResult = await db
    .select({
      platformOrderId: shopOrder.platformOrderId,
      shopId: shopOrder.shopId,
      shopName: shop.name,
      status: shopOrder.status,
    })
    .from(shopOrder)
    .leftJoin(shop, eq(shopOrder.shopId, shop.id))
    .where(inArray(shopOrder.platformOrderId, orderIds))

  const shopMap = new Map<string, BuyerOrderShopSummary[]>()
  for (const so of shopOrdersResult) {
    if (!so.platformOrderId) continue
    const list = shopMap.get(so.platformOrderId) ?? []
    list.push({
      shopId: so.shopId,
      shopName: so.shopName ?? 'Unknown shop',
      status: so.status,
    })
    shopMap.set(so.platformOrderId, list)
  }

  const orders: BuyerOrderListItem[] = ordersResult.map((order) => {
    const summary = shopMap.get(order.id) ?? []
    return {
      id: order.id,
      totalCents: order.totalCents,
      status: order.status,
      createdAt: order.createdAt,
      shopCount: summary.length,
      shopSummary: summary,
    }
  })

  return { orders, total: totalCount }
}

export async function cancelOrderQuery(
  platformOrderId: string,
  userId: string,
): Promise<{ success: boolean }> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderId))
      .for('update')
      .limit(1)

    if (!order || order.userId !== userId) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (order.status !== 'pending_payment') {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Order cannot be cancelled' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Sequential within transaction: the PostgreSQL driver does not support concurrent
    // queries on the same transaction connection, and stock release must run after the
    // order rows are updated.
    await tx
      .update(platformOrder)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    await releaseStockInTx(tx, platformOrderId)

    return { success: true }
  })
}
