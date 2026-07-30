import { and, eq, gt, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  cart,
  cartItem,
  inventoryReservation,
  platformOrder,
  product,
  shop,
  user,
} from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import type { ShippingAddress as ProviderShippingAddress } from '#/integrations/shipping'
import { decryptJsonb } from '../encryption.server'
import { ordersCreatedTotal } from '../metrics.server'
import { logOrderCreated } from '../order-logger'
import type { PaymentProvider } from '../payment-provider'
import { scheduleCheckoutPostOrderNotifications } from './notifications.server'
import { persistCheckoutOrder } from './order-persistence.server'
import { initiateCheckoutPayment, retryPayment } from './payment.server'
import { validateCheckoutShippingSelectionDetails } from './shipping.server'
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
  input.checkoutAttemptId ??= crypto.randomUUID()
  const [buyer] = await db
    .select({ isAnonymous: user.isAnonymous, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const [existingOrder] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.checkoutAttemptId, input.checkoutAttemptId))
    .limit(1)

  if (existingOrder) {
    if (existingOrder.userId !== userId) {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const [reservation] = await db
      .select({ expiresAt: inventoryReservation.expiresAt })
      .from(inventoryReservation)
      .where(
        and(
          eq(inventoryReservation.platformOrderId, existingOrder.id),
          gt(inventoryReservation.expiresAt, new Date()),
        ),
      )
      .limit(1)
    const payment = await retryPayment(existingOrder.id, userId, paymentProvider)
    return {
      platformOrderId: existingOrder.id,
      checkoutUrl: payment.checkoutUrl,
      reservationExpiresAt: reservation?.expiresAt ?? new Date(),
    }
  }

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
    // Encrypted at rest (`settings.server.ts` writes it with `encryptJsonb`).
    // A raw cast yields a base64 string here, which is truthy — so the guard
    // below passes and every address field reads `undefined`.
    const origin = decryptJsonb<ProviderShippingAddress | null>(shopRecord.shippingOrigin)
    if (origin) {
      originByShopId.set(shopRecord.id, origin)
    }
  }

  const shippingDetailsByShop = await validateCheckoutShippingSelectionDetails(
    Array.from(shopItemsMap, ([shopId, items]) => ({
      shopId,
      items,
      origin: originByShopId.get(shopId),
    })),
    input.shippingAddress,
    input.shippingSelections,
  )

  const result = await persistCheckoutOrder(
    input,
    userId,
    shippingDetailsByShop,
    buyer?.isAnonymous === true,
    buyer?.email ?? '',
  )
  const checkoutUrl = await initiateCheckoutPayment(
    result.platformOrderId,
    result.grandTotalCents,
    input.shippingAddress.country,
    paymentProvider,
  )

  const isGuest = buyer?.isAnonymous === true
  if (isGuest) {
    try {
      const { issueGuestOrderAccess } = await import('./guest-access.server')
      await issueGuestOrderAccess({
        platformOrderId: result.platformOrderId,
        orderNumber: result.orderNumber,
        email: input.shippingAddress.contactEmail ?? buyer?.email ?? '',
        buyerName: input.shippingAddress.name,
      })
    } catch (error) {
      const { logger } = await import('../logger.server')
      logger.error('Failed to issue guest order access', error, {
        alert: true,
        platformOrderId: result.platformOrderId,
      })
    }
  }

  if (checkoutUrl)
    scheduleCheckoutPostOrderNotifications({
      platformOrderId: result.platformOrderId,
      orderNumber: result.orderNumber,
      userId,
      grandTotalCents: result.grandTotalCents,
      createdShopOrders: result.createdShopOrders,
      isGuest,
    })

  ordersCreatedTotal.inc()
  logOrderCreated({
    platformOrderId: result.platformOrderId,
    userId,
    totalCents: result.grandTotalCents,
    shopOrderCount: result.createdShopOrders.length,
  })

  return {
    platformOrderId: result.platformOrderId,
    checkoutUrl,
    paymentInitiationFailed: checkoutUrl === null,
    reservationExpiresAt: result.reservationExpiresAt,
  }
}
