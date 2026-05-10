import { eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, shop, shopOrder } from '#/db/schema'
import type { ShippingAddress } from './checkout.server'

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
  items: OrderItemDetail[]
}

export interface OrderDetail {
  id: string
  totalCents: number
  status: string
  createdAt: Date
  shippingAddress: ShippingAddress
  shops: OrderShopGroup[]
}

export async function getOrderByIdQuery(
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
