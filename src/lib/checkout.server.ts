import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  cart,
  cartItem,
  orderItem,
  platformOrder,
  product,
  productImage,
  shop,
  shopOrder,
} from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import type { PaymentProvider } from './payment-provider'
import type {
  Package,
  ShippingAddress as ProviderShippingAddress,
  Rate,
} from '#/integrations/shipping'
import { mondialRelayProvider } from '#/integrations/shipping'
import { getBaseUrl } from './env.server'
import {
  getAvailableStockForProducts,
  InsufficientStockError,
  releaseStockInTx,
  reserveStockInTx,
} from './inventory.server'

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface ShippingOption {
  /** The rate ID from the carrier for validation in createCheckout. */
  rateId?: string
  /** Carrier identifier (e.g. "mondial_relay"). */
  carrier?: string
  /** Human-readable service name (e.g. "Mondial Relay Standard"). */
  serviceName?: string
  /** Price in euro cents (integer). */
  costCents: number
  /** Estimated delivery window in business days. */
  estimatedDays?: {
    min: number
    max: number
  }
  /** True when this option is a fallback and not from a live carrier. */
  fallback?: boolean
  /** Short label for display (e.g. "Standard", "Express", "Manual — contact seller"). */
  label: string
  /** Method identifier for backward compatibility. */
  method: 'standard' | 'express' | 'manual'
}

export interface CheckoutItem {
  productId: string
  name: string
  slug: string
  priceCents: number
  quantity: number
  imageUrl: string | null
}

export interface CheckoutShopGroup {
  shopId: string
  shopName: string
  shopSlug: string
  items: CheckoutItem[]
  subtotalCents: number
  shippingOptions: ShippingOption[]
}

export interface CheckoutSummary {
  cartId: string
  shops: CheckoutShopGroup[]
  grandTotalCents: number
}

export interface ShippingSelection {
  shopId: string
  /** The rate ID from the selected ShippingOption for server-side validation. */
  rateId?: string
  method: 'standard' | 'express' | 'manual'
}

export interface ShippingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
}

export interface CheckoutInput {
  cartId: string
  shippingSelections: ShippingSelection[]
  shippingAddress: ShippingAddress
  billingAddress: ShippingAddress
}

/* -------------------------------------------------------------------------- */
/*                               Shipping Costs                               */
/* -------------------------------------------------------------------------- */

/** Fallback shipping options shown when the provider is unavailable. */
const FALLBACK_SHIPPING_OPTIONS: ShippingOption[] = [
  {
    method: 'manual',
    rateId: undefined,
    costCents: 0,
    label: 'Manual shipping — contact seller',
    fallback: true,
  },
]

/** Fallback option used when the provider returns no rates for a destination. */
const UNSUPPORTED_FALLBACK: ShippingOption = {
  method: 'manual',
  rateId: undefined,
  costCents: 0,
  label: 'We cannot ship to this address — contact seller',
  fallback: true,
}

/** Error message shown when a destination is unsupported by the carrier. */
export const UNSUPPORTED_DESTINATION_ERROR = 'We cannot ship to this address'

/**
 * Platform default origin address used when shops do not have dedicated
 * shipping origin addresses configured.
 */
function getPlatformOrigin(): ProviderShippingAddress {
  return {
    street: 'Eurtisan Hub',
    city: 'Berlin',
    postalCode: '10115',
    country: 'DE',
  }
}

/**
 * Estimate a shipping package from a shop's cart items.
 *
 * Since products don't have dimensions yet, we use a per-item estimate
 * of 500 g and 20×15×5 cm, summed across all items in the shop group.
 */
function estimatePackageFromItems(items: CheckoutItem[]): Package {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    weightGrams: totalItems * 500,
    lengthCm: 20,
    widthCm: totalItems * 5, // rough stacking
    heightCm: 15,
  }
}

/**
 * Convert a list of carrier {@link Rate} objects into {@link ShippingOption}
 * objects suitable for the checkout UI.
 */
function ratesToShippingOptions(rates: Rate[], fallbackOnEmpty = false): ShippingOption[] {
  if (rates.length === 0) {
    return fallbackOnEmpty ? [UNSUPPORTED_FALLBACK] : []
  }

  return rates.map(
    (rate) =>
      ({
        rateId: rate.rateId,
        carrier: rate.carrier,
        serviceName: rate.serviceName,
        costCents: rate.priceCents,
        estimatedDays: rate.estimatedDays,
        label: rate.serviceName,
        method: rate.serviceName.toLowerCase().includes('express') ? 'express' : 'standard',
        fallback: false,
      }) satisfies ShippingOption,
  )
}

/**
 * Resolve shipping options for a single shop in the cart.
 *
 * Calls the {@link mondialRelayProvider} when a shipping address is available;
 * falls back to manual options when the provider is unavailable or the
 * destination is unsupported.
 */
export async function getShippingOptionsForShop(
  items: CheckoutItem[],
  shippingAddress?: ShippingAddress,
): Promise<ShippingOption[]> {
  if (!shippingAddress) {
    // No address yet — return fallback so the UI can show a placeholder.
    return FALLBACK_SHIPPING_OPTIONS
  }

  const pkg = estimatePackageFromItems(items)
  const origin = getPlatformOrigin()
  const destination: ProviderShippingAddress = {
    street: shippingAddress.street,
    city: shippingAddress.city,
    postalCode: shippingAddress.postalCode,
    country: shippingAddress.country,
    company: shippingAddress.name,
  }

  try {
    const rates = await mondialRelayProvider.getRates(origin, destination, pkg)
    if (rates.length === 0) {
      return [UNSUPPORTED_FALLBACK]
    }
    return ratesToShippingOptions(rates)
  } catch {
    // Provider unavailable — show manual fallback.
    return FALLBACK_SHIPPING_OPTIONS
  }
}

/**
 * Get the shipping cost in cents for a given shipping method and available
 * options. Used by createCheckout to compute the server-verified total.
 */
export function getShippingCostFromOptions(
  options: ShippingOption[],
  method: 'standard' | 'express' | 'manual',
  rateId?: string,
): number {
  const option =
    options.find((o) => o.rateId === rateId) ??
    options.find((o) => o.method === method) ??
    options[0]
  return option?.costCents ?? 0
}

/**
 * Backward-compatible helper that returns a fixed shipping cost.
 * @deprecated Use {@link getShippingCostFromOptions} for provider-aware costs.
 */
export function getShippingCost(method: 'standard' | 'express'): number {
  return method === 'express' ? 1000 : 500
}

/* -------------------------------------------------------------------------- */
/*                            getCheckoutSummary                              */
/* -------------------------------------------------------------------------- */

export async function getCheckoutSummaryQuery(
  cartId: string,
  userId: string,
  shippingAddress?: ShippingAddress,
): Promise<CheckoutSummary | null> {
  // Verify cart ownership
  const [cartRecord] = await db.select().from(cart).where(eq(cart.id, cartId)).limit(1)
  if (!cartRecord || cartRecord.userId !== userId) {
    return null
  }

  const items = await db
    .select({
      item: cartItem,
      product: product,
      shop: shop,
    })
    .from(cartItem)
    .leftJoin(product, eq(cartItem.productId, product.id))
    .leftJoin(shop, eq(product.shopId, shop.id))
    .where(eq(cartItem.cartId, cartId))

  const productIds = items.map((r) => r.product?.id).filter((id): id is string => !!id)

  const images =
    productIds.length > 0
      ? await db
          .select()
          .from(productImage)
          .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))
      : []

  const imageByProduct = new Map<string, string>()
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url)
    }
  }

  const groups = new Map<string, CheckoutShopGroup>()

  for (const row of items) {
    const productRecord = row.product
    const shopRecord = row.shop

    if (!productRecord || !shopRecord) {
      // Skip unavailable items for checkout summary (they shouldn't be checked out)
      continue
    }

    const checkoutItem: CheckoutItem = {
      productId: productRecord.id,
      name: productRecord.name,
      slug: productRecord.slug,
      priceCents: productRecord.priceCents,
      quantity: row.item.quantity,
      imageUrl: imageByProduct.get(productRecord.id) ?? null,
    }

    const existing = groups.get(shopRecord.id)
    if (existing) {
      existing.items.push(checkoutItem)
      existing.subtotalCents += productRecord.priceCents * row.item.quantity
    } else {
      groups.set(shopRecord.id, {
        shopId: shopRecord.id,
        shopName: shopRecord.name,
        shopSlug: shopRecord.slug,
        items: [checkoutItem],
        subtotalCents: productRecord.priceCents * row.item.quantity,
        shippingOptions: [],
      })
    }
  }

  const shops = Array.from(groups.values())

  // Fetch real shipping rates from the provider (or fallback when unavailable)
  for (const shop of shops) {
    shop.shippingOptions = await getShippingOptionsForShop(shop.items, shippingAddress)
  }

  const grandTotalCents = shops.reduce((sum, s) => sum + s.subtotalCents, 0)

  return {
    cartId,
    shops,
    grandTotalCents,
  }
}

/* -------------------------------------------------------------------------- */
/*                              createCheckout                                */
/* -------------------------------------------------------------------------- */

export interface CreateCheckoutResult {
  platformOrderId: string
  /** URL the buyer must visit to complete the Mollie payment. */
  checkoutUrl: string
}

export async function createCheckoutQuery(
  input: CheckoutInput,
  userId: string,
): Promise<CreateCheckoutResult> {
  return createCheckoutWithProvider(input, userId, molliePaymentProvider)
}

/**
 * Internal implementation that accepts an explicit payment provider so tests
 * can inject a controlled mock.
 */
export async function createCheckoutWithProvider(
  input: CheckoutInput,
  userId: string,
  paymentProvider: PaymentProvider,
): Promise<CreateCheckoutResult> {
  let platformOrderId = ''

  // -----------------------------------------------------------------------
  // Pre-transaction: validate shipping selections against the provider
  // -----------------------------------------------------------------------

  // 1. Verify cart ownership (lightweight check before heavier work)
  const [cartRecord] = await db.select().from(cart).where(eq(cart.id, input.cartId)).limit(1)
  if (!cartRecord || cartRecord.userId !== userId) {
    throw new Response(
      JSON.stringify({ error: 'Not Found', message: 'Cart not found or access denied' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Fetch cart items to determine shop groups and per-shop items
  const cartItems = await db
    .select({
      item: cartItem,
      product: product,
    })
    .from(cartItem)
    .leftJoin(product, eq(cartItem.productId, product.id))
    .where(eq(cartItem.cartId, input.cartId))

  if (cartItems.length === 0) {
    throw new Response(JSON.stringify({ error: 'Conflict', message: 'Cart is empty' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Build per-shop CheckoutItem lists to call the shipping provider
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
    })
    shopItemsMap.set(row.product.shopId, items)
  }

  // 4. Fetch available shipping options per shop from the provider
  const shippingOptionsByShop = new Map<string, ShippingOption[]>()
  for (const [shopId, items] of shopItemsMap) {
    shippingOptionsByShop.set(shopId, await getShippingOptionsForShop(items, input.shippingAddress))
  }

  // 5. Validate shipping selections
  const selectionMap = new Map<string, ShippingSelection>()
  for (const sel of input.shippingSelections) {
    selectionMap.set(sel.shopId, sel)
  }

  for (const shopId of shopItemsMap.keys()) {
    const selection = selectionMap.get(shopId)
    if (!selection) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Missing shipping selection for shop ${shopId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const options = shippingOptionsByShop.get(shopId) ?? []
    const matchingOption =
      options.find((o) => o.rateId === selection.rateId) ??
      options.find((o) => o.method === selection.method) ??
      options[0]

    if (!matchingOption) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Invalid shipping selection for shop ${shopId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check for unsupported destination
    if (matchingOption.fallback && matchingOption.label === UNSUPPORTED_FALLBACK.label) {
      throw new Response(
        JSON.stringify({
          error: 'Unprocessable',
          message: UNSUPPORTED_DESTINATION_ERROR,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // 6. Pre-calculate server-verified shipping costs per shop
  const shippingCostByShop = new Map<string, number>()
  for (const [shopId] of shopItemsMap) {
    const selection = selectionMap.get(shopId)
    if (!selection) continue // already validated above, defensive guard
    const options = shippingOptionsByShop.get(shopId) ?? []
    shippingCostByShop.set(
      shopId,
      getShippingCostFromOptions(options, selection.method, selection.rateId),
    )
  }

  // -----------------------------------------------------------------------
  // Database transaction
  // -----------------------------------------------------------------------

  const result = await db.transaction(async (tx) => {
    // 1. Re-fetch cart items inside transaction for stock validation
    const items = await tx
      .select({
        item: cartItem,
        product: product,
      })
      .from(cartItem)
      .leftJoin(product, eq(cartItem.productId, product.id))
      .where(eq(cartItem.cartId, input.cartId))

    if (items.length === 0) {
      throw new Response(JSON.stringify({ error: 'Conflict', message: 'Cart is empty' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Validate available stock for every product (accounting for reservations)
    const productIds = items.map((r) => r.product?.id).filter((id): id is string => !!id)
    const availableStockMap = await getAvailableStockForProducts(productIds)

    const outOfStockProductIds: string[] = []
    for (const row of items) {
      if (!row.product) {
        outOfStockProductIds.push(row.item.productId)
        continue
      }
      const availableStock = availableStockMap.get(row.product.id) ?? 0
      if (availableStock < row.item.quantity) {
        outOfStockProductIds.push(row.product.id)
      }
    }

    if (outOfStockProductIds.length > 0) {
      throw new Response(
        JSON.stringify({
          error: 'Conflict',
          message: 'Some items are out of stock',
          productIds: outOfStockProductIds,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 3. Group items by shop and calculate subtotals
    const shopGroups = new Map<
      string,
      {
        shopId: string
        items: Array<{ product: typeof product.$inferSelect; quantity: number }>
        subtotalCents: number
      }
    >()

    for (const row of items) {
      if (!row.product) continue
      const existing = shopGroups.get(row.product.shopId)
      if (existing) {
        existing.items.push({ product: row.product, quantity: row.item.quantity })
        existing.subtotalCents += row.product.priceCents * row.item.quantity
      } else {
        shopGroups.set(row.product.shopId, {
          shopId: row.product.shopId,
          items: [{ product: row.product, quantity: row.item.quantity }],
          subtotalCents: row.product.priceCents * row.item.quantity,
        })
      }
    }

    // 4. Calculate grand total using server-verified shipping costs
    let grandTotalCents = 0
    for (const [, group] of shopGroups) {
      const shipCost = shippingCostByShop.get(group.shopId) ?? 0
      grandTotalCents += group.subtotalCents + shipCost
    }

    // 5. Create platform order
    const [platformOrderRecord] = await tx
      .insert(platformOrder)
      .values({
        userId,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        totalCents: grandTotalCents,
        status: 'pending_payment',
      })
      .returning()

    // 6. Create shop orders and order items
    const createdShopOrders: Array<{ shopOrderId: string; shopId: string }> = []
    for (const [, group] of shopGroups) {
      const selection = selectionMap.get(group.shopId)
      const shipMethod = selection?.method ?? 'standard'
      const shipCost = shippingCostByShop.get(group.shopId) ?? 0

      const [shopOrderRecord] = await tx
        .insert(shopOrder)
        .values({
          platformOrderId: platformOrderRecord.id,
          shopId: group.shopId,
          shippingMethod: shipMethod,
          shippingCostCents: shipCost,
          subtotalCents: group.subtotalCents,
          status: 'pending_payment',
        })
        .returning()

      createdShopOrders.push({ shopOrderId: shopOrderRecord.id, shopId: group.shopId })

      for (const lineItem of group.items) {
        await tx.insert(orderItem).values({
          shopOrderId: shopOrderRecord.id,
          productId: lineItem.product.id,
          productName: lineItem.product.name,
          unitPriceCents: lineItem.product.priceCents,
          quantity: lineItem.quantity,
          totalCents: lineItem.product.priceCents * lineItem.quantity,
        })
      }
    }

    // 9. Reserve stock for every cart item atomically
    const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    for (const [, group] of shopGroups) {
      for (const lineItem of group.items) {
        try {
          await reserveStockInTx(
            tx,
            lineItem.product.id,
            platformOrderRecord.id,
            lineItem.quantity,
            reservationExpiresAt,
          )
        } catch (err) {
          if (err instanceof InsufficientStockError) {
            throw new Response(
              JSON.stringify({
                error: 'Conflict',
                message: 'Some items are out of stock',
                productIds: [lineItem.product.id],
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            )
          }
          throw err
        }
      }
    }

    // 10. Clear cart and its items
    await tx.delete(cartItem).where(eq(cartItem.cartId, input.cartId))
    await tx.delete(cart).where(eq(cart.id, input.cartId))

    return { platformOrderId: platformOrderRecord.id, createdShopOrders, grandTotalCents }
  })

  platformOrderId = result.platformOrderId

  // 2. Initiate payment with Mollie (OUTSIDE the transaction — this is an
  //    external API call that must not hold a database lock).
  const baseUrl = getBaseUrl()
  const redirectUrl = `${baseUrl}/orders/${platformOrderId}/success`
  const webhookUrl = `${baseUrl}/api/webhooks/mollie`

  let checkoutUrl: string

  try {
    const payment = await paymentProvider.createPayment(
      result.grandTotalCents,
      'EUR',
      `Eurtisan order ${platformOrderId}`,
      redirectUrl,
      webhookUrl,
    )

    // Persist the Mollie payment ID on the platform order
    await db
      .update(platformOrder)
      .set({ molliePaymentId: payment.paymentId, updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))

    checkoutUrl = payment.checkoutUrl
  } catch (_err) {
    // Payment initiation failed — cancel the order and restore inventory
    await db.transaction(async (tx) => {
      await tx
        .update(platformOrder)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: 'Payment provider error',
          updatedAt: new Date(),
        })
        .where(eq(platformOrder.id, platformOrderId))

      await tx
        .update(shopOrder)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(shopOrder.platformOrderId, platformOrderId))

      await releaseStockInTx(tx, platformOrderId)
    })

    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Payment could not be initiated. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Create notifications after the transaction so errors don't break checkout
  try {
    const { createNotification } = await import('./notifications.server')

    // Notify buyer
    await createNotification(userId, 'order_placed', {
      platformOrderId,
    })

    // Notify each seller
    for (const so of result.createdShopOrders) {
      const shopRecord = await db.select().from(shop).where(eq(shop.id, so.shopId)).limit(1)
      if (shopRecord[0]) {
        await createNotification(shopRecord[0].ownerId, 'order_placed', {
          platformOrderId,
          shopOrderId: so.shopOrderId,
        })
      }
    }
  } catch {
    // Notification errors must not break the primary checkout transaction
  }

  return { platformOrderId, checkoutUrl }
}
