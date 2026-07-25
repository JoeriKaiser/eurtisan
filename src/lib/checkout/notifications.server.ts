import { eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, shop, shopOrder, user } from '#/db/schema'
import { scheduleBackgroundWork } from '../background-work.server'
import { decryptJsonb } from '../encryption.server'
import { getBaseUrl } from '../env.server'
import { formatPriceEUR } from '../pricing'
import { buildShopLegalIdentity, toSellerEmailPayload } from '../shop-legal-identity'
import type { CreatedCheckoutShopOrder } from './order-persistence.server'

export interface CheckoutNotificationInput {
  platformOrderId: string
  orderNumber: string
  userId: string
  grandTotalCents: number
  createdShopOrders: CreatedCheckoutShopOrder[]
  isGuest?: boolean
}

/**
 * Queue post-checkout buyer and seller notifications after payment initiation
 * succeeds. The background-work boundary ensures that email-provider latency
 * and failures cannot delay or undo an otherwise valid checkout.
 */
export function scheduleCheckoutPostOrderNotifications(input: CheckoutNotificationInput): void {
  scheduleBackgroundWork(
    'checkout_post_order_notifications',
    async () => {
      const { createNotification, sendNotificationEmail } = await import('../notifications.server')
      const baseUrl = getBaseUrl()

      const [buyerRecord] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1)

      const allOrderItems = await db
        .select({
          productName: orderItem.productName,
          quantity: orderItem.quantity,
          totalCents: orderItem.totalCents,
          shopName: shop.name,
        })
        .from(orderItem)
        .innerJoin(shopOrder, eq(orderItem.shopOrderId, shopOrder.id))
        .innerJoin(shop, eq(shopOrder.shopId, shop.id))
        .where(eq(shopOrder.platformOrderId, input.platformOrderId))

      const buyerItems = allOrderItems.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        price: formatPriceEUR(item.totalCents),
      }))

      const orderShopIds = input.createdShopOrders.map((shopOrderRecord) => shopOrderRecord.shopId)
      const orderShops =
        orderShopIds.length > 0
          ? await db.select().from(shop).where(inArray(shop.id, orderShopIds))
          : []
      const orderShopOwners =
        orderShops.length > 0
          ? await db
              .select({ id: user.id, name: user.name, email: user.email })
              .from(user)
              .where(
                inArray(
                  user.id,
                  orderShops.map((shopRecord) => shopRecord.ownerId),
                ),
              )
          : []
      const ownerEmailById = new Map(orderShopOwners.map((owner) => [owner.id, owner.email]))
      const buyerSellerPayload =
        orderShops.length === 1
          ? toSellerEmailPayload(
              buildShopLegalIdentity({
                shopName: orderShops[0].name,
                ownerEmail: ownerEmailById.get(orderShops[0].ownerId) ?? '',
                vatId: orderShops[0].vatId,
                businessAddress: decryptJsonb(orderShops[0].businessAddress),
                shippingOrigin: decryptJsonb(orderShops[0].shippingOrigin),
              }),
            )
          : {}

      await createNotification(input.userId, 'order_placed', {
        platformOrderId: input.platformOrderId,
        orderNumber: input.orderNumber,
      })
      if (!input.isGuest)
        await sendNotificationEmail({
          userId: input.userId,
          template: 'order_confirmation',
          data: {
            orderNumber: input.orderNumber,
            buyerName: buyerRecord?.name,
            shopName: 'Eurtisan',
            items: buyerItems,
            total: formatPriceEUR(input.grandTotalCents),
            orderUrl: `${baseUrl}/orders/${input.platformOrderId}`,
            ...buyerSellerPayload,
          },
          idempotencyKey: `order:${input.platformOrderId}:confirmation:buyer`,
          category: 'transactional',
        })

      const orderItemsByShop = new Map<string, typeof allOrderItems>()
      for (const item of allOrderItems) {
        const list = orderItemsByShop.get(item.shopName) ?? []
        list.push(item)
        orderItemsByShop.set(item.shopName, list)
      }

      const shopById = new Map(orderShops.map((shopRecord) => [shopRecord.id, shopRecord]))
      const sellerById = new Map(orderShopOwners.map((owner) => [owner.id, owner]))

      await Promise.all(
        input.createdShopOrders.map(async (createdShopOrder) => {
          const shopRecord = shopById.get(createdShopOrder.shopId)
          if (!shopRecord) return

          const shopItems = orderItemsByShop.get(shopRecord.name) ?? []
          const shopItemByName = new Map(shopItems.map((item) => [item.productName, item]))
          const sellerItems = shopItems.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: formatPriceEUR(item.totalCents),
          }))
          const sellerRecord = sellerById.get(shopRecord.ownerId)
          const sellerPayload = toSellerEmailPayload(
            buildShopLegalIdentity({
              shopName: shopRecord.name,
              ownerEmail: sellerRecord?.email ?? '',
              vatId: shopRecord.vatId,
              businessAddress: decryptJsonb(shopRecord.businessAddress),
              shippingOrigin: decryptJsonb(shopRecord.shippingOrigin),
            }),
          )

          await Promise.all([
            createNotification(shopRecord.ownerId, 'order_placed', {
              platformOrderId: input.platformOrderId,
              orderNumber: input.orderNumber,
              shopOrderId: createdShopOrder.shopOrderId,
            }),
            sendNotificationEmail({
              userId: shopRecord.ownerId,
              template: 'order_confirmation',
              data: {
                orderNumber: input.orderNumber,
                buyerName: sellerRecord?.name ?? null,
                shopName: shopRecord.name,
                items: sellerItems,
                total: formatPriceEUR(
                  sellerItems.reduce((sum, item) => {
                    const cents = shopItemByName.get(item.name)?.totalCents ?? 0
                    return sum + cents
                  }, 0),
                ),
                orderUrl: `${baseUrl}/studio/${createdShopOrder.shopId}/orders/${createdShopOrder.shopOrderId}`,
                ...sellerPayload,
              },
              idempotencyKey: `order:${input.platformOrderId}:confirmation:seller:${createdShopOrder.shopId}`,
              category: 'transactional',
            }),
          ])
        }),
      )
    },
    { platformOrderId: input.platformOrderId, userId: input.userId },
  )
}
