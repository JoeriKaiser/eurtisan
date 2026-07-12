import { eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { cart, cartItem, product, shop } from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import type { ShippingAddress as ProviderShippingAddress } from '#/integrations/shipping'
import { ordersCreatedTotal } from '../metrics.server'
import { logOrderCreated } from '../order-logger'
import type { PaymentProvider } from '../payment-provider'
import { scheduleCheckoutPostOrderNotifications } from './notifications.server'
import { persistCheckoutOrder } from './order-persistence.server'
import { initiateCheckoutPayment } from './payment.server'
import { validateCheckoutShippingSelections } from './shipping.server'
import type { CheckoutInput, CheckoutItem, CreateCheckoutResult } from './types'

/**
 * Create a checkout using the production payment provider. Browser-callable
 * server functions retain this public contract while orchestration remains in
 * a server-only module.
 */
export async function createCheckoutQuery(
  input: CheckoutInput,
  userId: string,
): Promise<CreateCheckoutResult> {
  return createCheckoutWithProvider(input, userId, molliePaymentProvider)
}

/**
 * Orchestrate checkout finalization around explicit boundaries:
 *
 * - fresh carrier quote validation before any database mutation;
 * - atomic order persistence and inventory reservation;
 * - payment initiation after the transaction commits;
 * - non-blocking post-order notifications only after payment starts.
 *
 * The injectable payment provider is used by integration tests and prevents
 * external payment calls from reaching the test environment.
 */
export async function createCheckoutWithProvider(
  input: CheckoutInput,
  userId: string,
  paymentProvider: PaymentProvider,
): Promise<CreateCheckoutResult> {
  const [cartRecord] = await db.select().from(cart).where(eq(cart.id, input.cartId)).limit(1)
  if (!cartRecord || cartRecord.userId !== userId) {
    throw new Response(
      JSON.stringify({ error: 'Not Found', message: 'Cart not found or access denied' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const cartItems = await db
    .select({
      item: cartItem,
      product,
    })
    .from(cartItem)
    .leftJoin(product, eq(cartItem.productId, product.id))
    .where(eq(cartItem.cartId, input.cartId))

  if (cartItems.length === 0) {
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'Cart is empty', code: 'CART_EMPTY' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const shopItemsMap = new Map<string, CheckoutItem[]>()
  for (const row of cartItems) {
    if (!row.product) continue

    const items = shopItemsMap.get(row.product.shopId) ?? []
    items.push({
      productId: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      priceCents: row.product.priceCents,
      quantity: row.item.quantity,
      imageUrl: null,
      weightGrams: row.product.weightGrams,
      lengthCm: row.product.lengthCm,
      widthCm: row.product.widthCm,
      heightCm: row.product.heightCm,
    })
    shopItemsMap.set(row.product.shopId, items)
  }

  const shopIds = Array.from(shopItemsMap.keys())
  const shopRecords =
    shopIds.length > 0 ? await db.select().from(shop).where(inArray(shop.id, shopIds)) : []
  const originByShopId = new Map<string, ProviderShippingAddress | undefined>()
  for (const shopRecord of shopRecords) {
    const origin = shopRecord.shippingOrigin as ProviderShippingAddress | null
    if (origin) {
      originByShopId.set(shopRecord.id, origin)
    }
  }

  const shippingCostByShop = await validateCheckoutShippingSelections(
    Array.from(shopItemsMap, ([shopId, items]) => ({
      shopId,
      items,
      origin: originByShopId.get(shopId),
    })),
    input.shippingAddress,
    input.shippingSelections,
  )

  const result = await persistCheckoutOrder(input, userId, shippingCostByShop)
  const checkoutUrl = await initiateCheckoutPayment(
    result.platformOrderId,
    result.grandTotalCents,
    input.shippingAddress.country,
    paymentProvider,
  )

  scheduleCheckoutPostOrderNotifications({
    platformOrderId: result.platformOrderId,
    orderNumber: result.orderNumber,
    userId,
    grandTotalCents: result.grandTotalCents,
    createdShopOrders: result.createdShopOrders,
  })

  ordersCreatedTotal.inc()
  logOrderCreated({
    platformOrderId: result.platformOrderId,
    userId,
    totalCents: result.grandTotalCents,
    shopOrderCount: result.createdShopOrders.length,
  })

  return { platformOrderId: result.platformOrderId, checkoutUrl }
}
