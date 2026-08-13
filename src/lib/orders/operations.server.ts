import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  dispute,
  invoices,
  orderItem,
  platformOrder,
  productImage,
  shippingLabel,
  shop,
  shopOrder,
} from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import type { ShippingAddress } from '../checkout.server'
import { decryptJsonb } from '../encryption.server'
import { releaseStockInTx } from '../inventory.server'
import { getNonDeliveryEligibility } from '../disputes/non-delivery'
import type {
  BuyerOrderListItem,
  BuyerOrderShopSummary,
  OrderDetail,
  OrderShopGroup,
} from './types'

export async function getShopOrderPlatformOrderId(shopOrderId: string): Promise<string | null> {
  const [record] = await db
    .select({ platformOrderId: shopOrder.platformOrderId })
    .from(shopOrder)
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)
  return record?.platformOrderId ?? null
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
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      totalCents: platformOrder.totalCents,
      status: platformOrder.status,
      paidAt: platformOrder.paidAt,
      createdAt: platformOrder.createdAt,
      cancelledAt: platformOrder.cancelledAt,
      cancellationReason: platformOrder.cancellationReason,
      shippingAddress: platformOrder.shippingAddress,
      userId: platformOrder.userId,
    })
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

  const itemProductIds = itemsResult
    .map((item) => item.productId)
    .filter((id): id is string => !!id)
  const productImagesResult =
    itemProductIds.length > 0
      ? await db
          .select()
          .from(productImage)
          .where(
            and(inArray(productImage.productId, itemProductIds), eq(productImage.sortOrder, 0)),
          )
      : []
  const imageUrlByProductId = new Map<string, string>()
  for (const image of productImagesResult) {
    if (!imageUrlByProductId.has(image.productId)) {
      imageUrlByProductId.set(image.productId, image.url)
    }
  }

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

  const invoicesResult =
    shopOrderIds.length > 0
      ? await db
          .select({
            shopOrderId: invoices.shopOrderId,
            invoiceNumber: invoices.invoiceNumber,
          })
          .from(invoices)
          .where(and(inArray(invoices.shopOrderId, shopOrderIds), eq(invoices.type, 'customer')))
      : []

  const invoiceNumberByShopOrderId = new Map(
    invoicesResult.map((record) => [record.shopOrderId, record.invoiceNumber]),
  )

  const disputesResult =
    shopOrderIds.length > 0
      ? await db
          .select({
            shopOrderId: dispute.shopOrderId,
            disputeId: dispute.id,
          })
          .from(dispute)
          .where(inArray(dispute.shopOrderId, shopOrderIds))
      : []

  const disputeIdByShopOrderId = new Map(
    disputesResult.map((record) => [record.shopOrderId, record.disputeId]),
  )

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
        const provider = getShippingProvider()
        const trackPromise = provider.trackShipment(label.trackingNumber)
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
      } catch {
        // If there was a timeout/error, and we have an expired cached value, return it as a fallback
        if (cached) {
          return { shopOrderId: so.shopOrder.id, status: cached.status }
        }
        return null
      } finally {
        clearTimeout(timerId)
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
      shippingRateId: so.shopOrder.shippingRateId ?? null,
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
      trackingStatus: trackingStatusMap.get(so.shopOrder.id) ?? so.shopOrder.trackingStatus ?? null,
      nonDeliveryEligibility: getNonDeliveryEligibility({
        status: so.shopOrder.status,
        createdAt: so.shopOrder.createdAt,
        paidAt: order.paidAt,
        shippingMethod: so.shopOrder.shippingMethod,
        fulfillmentDueAt: so.shopOrder.fulfillmentDueAt,
        earliestDeliveryAt: so.shopOrder.earliestDeliveryAt,
        deliveryDueAt: so.shopOrder.deliveryDueAt,
        shippedAt: so.shopOrder.shippedAt,
        trackingStatus: so.shopOrder.trackingStatus,
        lastTrackingEventAt: so.shopOrder.lastTrackingEventAt,
      }),
      invoiceNumber: invoiceNumberByShopOrderId.get(so.shopOrder.id) ?? null,
      disputeId: disputeIdByShopOrderId.get(so.shopOrder.id) ?? null,
      items: (itemsByShopOrderId.get(so.shopOrder.id) ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
        vatRateBasisPoints: item.vatRateBasisPoints,
        vatAmountCents: item.vatAmountCents,
        imageUrl: imageUrlByProductId.get(item.productId) ?? null,
      })),
    }
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    shippingAddress: decryptJsonb<ShippingAddress>(order.shippingAddress),
    shops,
  }
}

export async function getBuyerOrderDetailByOrderNumberQuery(
  orderNumber: string,
  userId: string,
): Promise<OrderDetail | null> {
  const [order] = await db
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      totalCents: platformOrder.totalCents,
      status: platformOrder.status,
      paidAt: platformOrder.paidAt,
      createdAt: platformOrder.createdAt,
      cancelledAt: platformOrder.cancelledAt,
      cancellationReason: platformOrder.cancellationReason,
      shippingAddress: platformOrder.shippingAddress,
      userId: platformOrder.userId,
    })
    .from(platformOrder)
    .where(eq(platformOrder.orderNumber, orderNumber))
    .limit(1)

  if (!order || order.userId !== userId) {
    return null
  }

  const platformOrderId = order.id
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

  const itemProductIds = itemsResult
    .map((item) => item.productId)
    .filter((id): id is string => !!id)
  const productImagesResult =
    itemProductIds.length > 0
      ? await db
          .select()
          .from(productImage)
          .where(
            and(inArray(productImage.productId, itemProductIds), eq(productImage.sortOrder, 0)),
          )
      : []
  const imageUrlByProductId = new Map<string, string>()
  for (const image of productImagesResult) {
    if (!imageUrlByProductId.has(image.productId)) {
      imageUrlByProductId.set(image.productId, image.url)
    }
  }

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

  const invoicesResult =
    shopOrderIds.length > 0
      ? await db
          .select({
            shopOrderId: invoices.shopOrderId,
            invoiceNumber: invoices.invoiceNumber,
          })
          .from(invoices)
          .where(and(inArray(invoices.shopOrderId, shopOrderIds), eq(invoices.type, 'customer')))
      : []

  const invoiceNumberByShopOrderId = new Map(
    invoicesResult.map((record) => [record.shopOrderId, record.invoiceNumber]),
  )

  const disputesResult =
    shopOrderIds.length > 0
      ? await db
          .select({
            shopOrderId: dispute.shopOrderId,
            disputeId: dispute.id,
          })
          .from(dispute)
          .where(inArray(dispute.shopOrderId, shopOrderIds))
      : []

  const disputeIdByShopOrderId = new Map(
    disputesResult.map((record) => [record.shopOrderId, record.disputeId]),
  )

  const trackingStatuses = await Promise.all(
    shopOrdersResult.map(async (so) => {
      const labels = labelsByShopOrderId.get(so.shopOrder.id) ?? []
      const label = labels.find((l) => l.trackingNumber)
      if (!label?.trackingNumber) return null

      const cached = trackingCache.get(label.trackingNumber)
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return { shopOrderId: so.shopOrder.id, status: cached.status }
      }

      let timerId: ReturnType<typeof setTimeout> | undefined
      try {
        const provider = getShippingProvider()
        const trackPromise = provider.trackShipment(label.trackingNumber)
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT_MS)
        })

        const info = await Promise.race([trackPromise, timeoutPromise])

        trackingCache.set(label.trackingNumber, {
          status: info.status,
          cachedAt: Date.now(),
        })

        return { shopOrderId: so.shopOrder.id, status: info.status }
      } catch {
        if (cached) {
          return { shopOrderId: so.shopOrder.id, status: cached.status }
        }
        return null
      } finally {
        clearTimeout(timerId)
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
      shippingRateId: so.shopOrder.shippingRateId ?? null,
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
      trackingStatus: trackingStatusMap.get(so.shopOrder.id) ?? so.shopOrder.trackingStatus ?? null,
      nonDeliveryEligibility: getNonDeliveryEligibility({
        status: so.shopOrder.status,
        createdAt: so.shopOrder.createdAt,
        paidAt: order.paidAt,
        shippingMethod: so.shopOrder.shippingMethod,
        fulfillmentDueAt: so.shopOrder.fulfillmentDueAt,
        earliestDeliveryAt: so.shopOrder.earliestDeliveryAt,
        deliveryDueAt: so.shopOrder.deliveryDueAt,
        shippedAt: so.shopOrder.shippedAt,
        trackingStatus: so.shopOrder.trackingStatus,
        lastTrackingEventAt: so.shopOrder.lastTrackingEventAt,
      }),
      invoiceNumber: invoiceNumberByShopOrderId.get(so.shopOrder.id) ?? null,
      disputeId: disputeIdByShopOrderId.get(so.shopOrder.id) ?? null,
      items: (itemsByShopOrderId.get(so.shopOrder.id) ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
        vatRateBasisPoints: item.vatRateBasisPoints,
        vatAmountCents: item.vatAmountCents,
        imageUrl: imageUrlByProductId.get(item.productId) ?? null,
      })),
    }
  })

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    shippingAddress: decryptJsonb<ShippingAddress>(order.shippingAddress),
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
        orderNumber: platformOrder.orderNumber,
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
      orderNumber: order.orderNumber,
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
