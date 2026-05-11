import { count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shop, shopOrder } from '#/db/schema'
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

export interface OrderItemDetail {
  id: string
  productId: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
}

export interface OrderShopGroup {
  shopId: string
  shopName: string
  shippingMethod: 'standard' | 'express'
  shippingCostCents: number
  subtotalCents: number
  status: OrderStatus
  trackingNumber: string | null
  trackingUrl: string | null
  items: OrderItemDetail[]
}

export interface OrderDetail {
  id: string
  totalCents: number
  status: OrderStatus
  createdAt: Date
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

  const shops: OrderShopGroup[] = shopOrdersResult.map((so) => ({
    shopId: so.shopOrder.shopId,
    shopName: so.shop?.name ?? 'Unknown shop',
    shippingMethod: so.shopOrder.shippingMethod,
    shippingCostCents: so.shopOrder.shippingCostCents,
    subtotalCents: so.shopOrder.subtotalCents,
    status: so.shopOrder.status,
    trackingNumber: so.shopOrder.trackingNumber,
    trackingUrl: so.shopOrder.trackingUrl,
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
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
    shippingAddress: order.shippingAddress as ShippingAddress,
    shops,
  }
}

export async function listBuyerOrdersQuery(
  userId: string,
  limit: number,
  offset: number,
): Promise<{ orders: BuyerOrderListItem[]; total: number }> {
  const ordersResult = await db
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
    .offset(offset)

  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(platformOrder)
    .where(eq(platformOrder.userId, userId))

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

    await tx
      .update(platformOrder)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    await releaseStockInTx(tx, platformOrderId)

    return { success: true }
  })
}
