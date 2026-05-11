import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shopOrder, user } from '#/db/schema'
import type { ShippingAddress } from './checkout.server'

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

export async function getShopOrderQuery(shopOrderId: string): Promise<ShopOrderDetail | null> {
  const [shopOrderRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)

  if (!shopOrderRecord) {
    return null
  }

  const [platformOrderRecord] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, shopOrderRecord.platformOrderId))
    .limit(1)

  if (!platformOrderRecord) {
    return null
  }

  const [buyerRecord] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, platformOrderRecord.userId))
    .limit(1)

  const items = await db
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
