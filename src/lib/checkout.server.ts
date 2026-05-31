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
  user,
} from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
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
  releaseCartStockInTx,
  reserveStockInTx,
} from './inventory.server'
import { logOrderCreated } from './order-logger'
import { ordersCreatedTotal } from './metrics.server'
import type { PaymentProvider } from './payment-provider'
import { formatPriceEUR } from './pricing'
import { calculatePackageDimensions, calculatePackageWeight } from './shipping-estimate'
import {
  buildShopLegalIdentity,
  toSellerEmailPayload,
  type ShopLegalIdentity,
} from './shop-legal-identity'
import { scheduleBackgroundWork } from './background-work.server'
import { calculateVat } from './vat.server'

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
  /** Estimated VAT in cents for display in checkout summary. */
  vatEstimateCents: number
  shippingOptions: ShippingOption[]
  /** EU trader information for pre-contract disclosure. */
  sellerLegal: ShopLegalIdentity
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
  /** The cost in cents the user was quoted for this option. */
  costCents: number
}

export interface ShippingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
  pickupPoint?: {
    id: string
    name: string
    street: string
    postalCode: string
    city: string
    country: string
  }
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
    weightGrams: calculatePackageWeight(totalItems),
    ...calculatePackageDimensions(totalItems),
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
  origin?: ProviderShippingAddress,
): Promise<ShippingOption[]> {
  if (!shippingAddress) {
    // No address yet — return fallback so the UI can show a placeholder.
    return FALLBACK_SHIPPING_OPTIONS
  }

  const pkg = estimatePackageFromItems(items)
  const effectiveOrigin = origin ?? getPlatformOrigin()
  const destination: ProviderShippingAddress = {
    street: shippingAddress.street,
    city: shippingAddress.city,
    postalCode: shippingAddress.postalCode,
    country: shippingAddress.country,
    company: shippingAddress.name,
  }

  try {
    const rates = await mondialRelayProvider.getRates(effectiveOrigin, destination, pkg)
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
  shippingSelections?: ShippingSelection[],
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
    const quantity = row.item.quantity

    if (!productRecord || !shopRecord) {
      // Skip unavailable items for checkout summary (they shouldn't be checked out)
      continue
    }

    const checkoutItem: CheckoutItem = {
      productId: productRecord.id,
      name: productRecord.name,
      slug: productRecord.slug,
      priceCents: productRecord.priceCents,
      quantity,
      imageUrl: imageByProduct.get(productRecord.id) ?? null,
    }

    const existing = groups.get(shopRecord.id)
    if (existing) {
      existing.items.push(checkoutItem)
      existing.subtotalCents += productRecord.priceCents * quantity
    } else {
      groups.set(shopRecord.id, {
        shopId: shopRecord.id,
        shopName: shopRecord.name,
        shopSlug: shopRecord.slug,
        items: [checkoutItem],
        subtotalCents: productRecord.priceCents * quantity,
        vatEstimateCents: 0,
        shippingOptions: [],
        sellerLegal: buildShopLegalIdentity({
          shopName: shopRecord.name,
          ownerEmail: '',
          vatId: shopRecord.vatId,
          businessAddress: shopRecord.businessAddress,
          shippingOrigin: shopRecord.shippingOrigin,
        }),
      })
    }
  }

  const shops = Array.from(groups.values())

  // Index shop records for O(1) lookup before fetching shipping rates
  const shopRecordById = new Map<string, NonNullable<(typeof items)[number]['shop']>>()
  for (const r of items) {
    if (r.shop?.id) {
      shopRecordById.set(r.shop.id, r.shop)
    }
  }

  const ownerIds = [
    ...new Set(shops.map((s) => shopRecordById.get(s.shopId)?.ownerId).filter(Boolean)),
  ]
  const ownerRows =
    ownerIds.length > 0
      ? await db
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(inArray(user.id, ownerIds as string[]))
      : []
  const ownerEmailById = new Map(ownerRows.map((row) => [row.id, row.email]))

  for (const shopGroup of shops) {
    const shopRecord = shopRecordById.get(shopGroup.shopId)
    const ownerEmail = shopRecord ? (ownerEmailById.get(shopRecord.ownerId) ?? '') : ''
    shopGroup.sellerLegal = shopRecord
      ? buildShopLegalIdentity({
          shopName: shopRecord.name,
          ownerEmail,
          vatId: shopRecord.vatId,
          businessAddress: shopRecord.businessAddress,
          shippingOrigin: shopRecord.shippingOrigin,
        })
      : {
          tradeName: shopGroup.shopName,
          contactEmail: ownerEmail,
          vatId: null,
          address: null,
        }
  }

  // Fetch real shipping rates from the provider in parallel
  await Promise.all(
    shops.map(async (shop) => {
      const shopRecord = shopRecordById.get(shop.shopId)
      const shopOrigin = shopRecord?.shippingOrigin as ProviderShippingAddress | null
      shop.shippingOptions = await getShippingOptionsForShop(
        shop.items,
        shippingAddress,
        shopOrigin ?? undefined,
      )
    }),
  )

  // Calculate VAT estimates per shop based on shipping destination
  const selectionByShopId = new Map(shippingSelections?.map((s) => [s.shopId, s]) ?? [])
  for (const shopGroup of shops) {
    const shopRecord = shopRecordById.get(shopGroup.shopId)
    if (!shopRecord) continue

    const sellerCountry = (shopRecord.shippingOrigin as { country?: string } | null)?.country ?? ''
    const buyerCountry = shippingAddress?.country ?? ''

    let vatEstimateCents = 0
    for (const row of items) {
      if (row.shop?.id !== shopGroup.shopId || !row.product) continue
      const prod = row.product
      const qty = row.item.quantity
      const itemVat = calculateVat({
        sellerCountry,
        buyerCountry,
        isVatRegistered: shopRecord.isVatRegistered,
        vatRateCategory: (prod.vatRateCategory as 'standard' | 'reduced' | 'exempt') ?? 'standard',
        inclusiveAmountCents: prod.priceCents * qty,
      })
      vatEstimateCents += itemVat.vatAmountCents
    }

    // Shipping VAT estimate (using standard rate on selected shipping)
    const selection = selectionByShopId.get(shopGroup.shopId)
    const optionByRateId = new Map(shopGroup.shippingOptions.map((o) => [o.rateId, o]))
    const optionByMethod = new Map(shopGroup.shippingOptions.map((o) => [o.method, o]))
    const optionByFallback = new Map(shopGroup.shippingOptions.map((o) => [o.fallback, o])).get(
      false,
    )
    const selectedOption = selection
      ? (optionByRateId.get(selection.rateId) ??
        optionByMethod.get(selection.method) ??
        optionByFallback ??
        shopGroup.shippingOptions[0])
      : (optionByFallback ?? shopGroup.shippingOptions[0])
    if (selectedOption && selectedOption.costCents > 0) {
      const shippingVat = calculateVat({
        sellerCountry,
        buyerCountry,
        isVatRegistered: shopRecord.isVatRegistered,
        vatRateCategory: 'standard',
        inclusiveAmountCents: selectedOption.costCents,
      })
      vatEstimateCents += shippingVat.vatAmountCents
    }

    shopGroup.vatEstimateCents = vatEstimateCents
  }

  const grandTotalCents = shops.reduce((sum, s) => {
    const selection = shippingSelections?.find((sel) => sel.shopId === s.shopId)
    const selectedOption = selection
      ? (s.shippingOptions.find((o) => o.rateId === selection.rateId) ??
        s.shippingOptions.find((o) => o.method === selection.method) ??
        s.shippingOptions.find((o) => !o.fallback) ??
        s.shippingOptions[0])
      : (s.shippingOptions.find((o) => !o.fallback) ?? s.shippingOptions[0])
    return sum + s.subtotalCents + (selectedOption?.costCents ?? 0)
  }, 0)

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
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'Cart is empty', code: 'CART_EMPTY' }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    )
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

  // Fetch shop records to resolve per-shop shipping origins
  const shopIds = Array.from(shopItemsMap.keys())
  const shopRecords =
    shopIds.length > 0 ? await db.select().from(shop).where(inArray(shop.id, shopIds)) : []
  const originByShopId = new Map<string, ProviderShippingAddress | undefined>()
  for (const sr of shopRecords) {
    const origin = sr.shippingOrigin as ProviderShippingAddress | null
    if (origin) {
      originByShopId.set(sr.id, origin)
    }
  }

  // 4. Fetch available shipping options per shop from the provider in parallel
  const shippingEntries = await Promise.all(
    Array.from(shopItemsMap.entries()).map(async ([shopId, items]) => {
      const options = await getShippingOptionsForShop(
        items,
        input.shippingAddress,
        originByShopId.get(shopId),
      )
      return [shopId, options] as [string, ShippingOption[]]
    }),
  )
  const shippingOptionsByShop = new Map(shippingEntries)

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
    let matchingOption: ShippingOption | undefined

    if (selection.rateId !== undefined) {
      matchingOption = options.find((o) => o.rateId === selection.rateId)
    } else {
      matchingOption = options.find((o) => o.method === selection.method)
    }

    if (!matchingOption) {
      // When the only available options are fallbacks, the real issue is
      // provider unavailability, not an invalid client selection.
      const hasRealOption = options.some((o) => !o.fallback)
      if (!hasRealOption && options.length > 0) {
        const fallbackOption = options[0]
        if (fallbackOption.label === UNSUPPORTED_FALLBACK.label) {
          throw new Response(
            JSON.stringify({
              error: 'Unprocessable',
              message: UNSUPPORTED_DESTINATION_ERROR,
            }),
            { status: 422, headers: { 'Content-Type': 'application/json' } },
          )
        }
        throw new Response(
          JSON.stringify({
            error: 'Service Unavailable',
            message: 'Shipping rates are temporarily unavailable. Please try again.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        )
      }

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

    if (matchingOption.fallback) {
      throw new Response(
        JSON.stringify({
          error: 'Service Unavailable',
          message: 'Shipping rates are temporarily unavailable. Please try again.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (matchingOption.costCents !== selection.costCents) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Shipping cost mismatch for shop ${shopId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
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
        shopRecord: shop,
      })
      .from(cartItem)
      .leftJoin(product, eq(cartItem.productId, product.id))
      .leftJoin(shop, eq(product.shopId, shop.id))
      .where(eq(cartItem.cartId, input.cartId))

    if (items.length === 0) {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Cart is empty', code: 'CART_EMPTY' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // 2. Validate product and shop approval status
    for (const row of items) {
      if (
        !row.product ||
        !row.shopRecord ||
        !row.product.isActive ||
        row.shopRecord.status !== 'active' ||
        row.shopRecord.isSuspended
      ) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Request',
            message: 'One or more items in your cart are no longer available.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    // 3. Release cart reservations before validating stock so the cart's own
    //    reservations are not double-counted against available inventory.
    await releaseCartStockInTx(tx, input.cartId)

    // 4. Validate available stock for every product (accounting for reservations)
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
          code: 'ITEMS_OUT_OF_STOCK',
          productIds: outOfStockProductIds,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 4. Group items by shop and calculate subtotals + VAT
    const shopGroups = new Map<
      string,
      {
        shopId: string
        items: Array<{
          product: typeof product.$inferSelect
          quantity: number
          vatRateBasisPoints: number
          vatAmountCents: number
        }>
        subtotalCents: number
        vatAmountCents: number
        shippingVatRateBasisPoints: number
        shippingVatAmountCents: number
      }
    >()

    for (const row of items) {
      const prod = row.product
      const shopRec = row.shopRecord
      if (!prod || !shopRec) continue
      const qty = row.item.quantity
      const sellerCountry = (shopRec.shippingOrigin as { country?: string } | null)?.country ?? ''
      const buyerCountry = input.shippingAddress.country

      const itemVat = calculateVat({
        sellerCountry,
        buyerCountry,
        isVatRegistered: shopRec.isVatRegistered,
        vatRateCategory: (prod.vatRateCategory as 'standard' | 'reduced' | 'exempt') ?? 'standard',
        inclusiveAmountCents: prod.priceCents * qty,
      })

      const existing = shopGroups.get(prod.shopId)
      if (existing) {
        existing.items.push({
          product: prod,
          quantity: qty,
          vatRateBasisPoints: itemVat.vatRateBasisPoints,
          vatAmountCents: itemVat.vatAmountCents,
        })
        existing.subtotalCents += prod.priceCents * qty
        existing.vatAmountCents += itemVat.vatAmountCents
      } else {
        const shipCost = shippingCostByShop.get(prod.shopId) ?? 0
        const shippingVat = calculateVat({
          sellerCountry,
          buyerCountry,
          isVatRegistered: shopRec.isVatRegistered,
          vatRateCategory: 'standard',
          inclusiveAmountCents: shipCost,
        })
        shopGroups.set(prod.shopId, {
          shopId: prod.shopId,
          items: [
            {
              product: prod,
              quantity: qty,
              vatRateBasisPoints: itemVat.vatRateBasisPoints,
              vatAmountCents: itemVat.vatAmountCents,
            },
          ],
          subtotalCents: prod.priceCents * qty,
          vatAmountCents: itemVat.vatAmountCents,
          shippingVatRateBasisPoints: shippingVat.vatRateBasisPoints,
          shippingVatAmountCents: shippingVat.vatAmountCents,
        })
      }
    }

    // 5. Calculate grand total using server-verified shipping costs
    let grandTotalCents = 0
    for (const [, group] of shopGroups) {
      const shipCost = shippingCostByShop.get(group.shopId) ?? 0
      grandTotalCents += group.subtotalCents + shipCost
    }

    // 6. Create platform order
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

    // 7. Create shop orders and order items
    const createdShopOrders = await Promise.all(
      Array.from(shopGroups.values()).map(async (group) => {
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
            vatAmountCents: group.vatAmountCents,
            shippingVatRateBasisPoints: group.shippingVatRateBasisPoints,
            shippingVatAmountCents: group.shippingVatAmountCents,
            status: 'pending_payment',
          })
          .returning()

        await Promise.all(
          group.items.map((lineItem) =>
            tx.insert(orderItem).values({
              shopOrderId: shopOrderRecord.id,
              productId: lineItem.product.id,
              productName: lineItem.product.name,
              unitPriceCents: lineItem.product.priceCents,
              quantity: lineItem.quantity,
              totalCents: lineItem.product.priceCents * lineItem.quantity,
              vatRateBasisPoints: lineItem.vatRateBasisPoints,
              vatAmountCents: lineItem.vatAmountCents,
            }),
          ),
        )

        return { shopOrderId: shopOrderRecord.id, shopId: group.shopId }
      }),
    )

    // 8. Reserve stock for every cart item atomically
    // Intentionally sequential within transaction to avoid row-lock contention on product inventory.
    // Sort by product ID to guarantee deterministic lock ordering and prevent deadlocks between
    // concurrent checkouts that have the same products in different cart insertion orders.
    const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    const allLineItems = Array.from(shopGroups.values()).flatMap((group) => group.items)
    allLineItems.sort((a, b) => a.product.id.localeCompare(b.product.id))
    for (const lineItem of allLineItems) {
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
              code: 'ITEMS_OUT_OF_STOCK',
              productIds: [lineItem.product.id],
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          )
        }
        throw err
      }
    }

    // 9. Clear cart and its items
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
      input.shippingAddress.country,
    )

    // Persist the Mollie payment ID on the platform order
    await db
      .update(platformOrder)
      .set({ molliePaymentId: payment.paymentId, updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))

    checkoutUrl = payment.checkoutUrl
  } catch (_err) {
    // Payment initiation failed — keep the order in pending_payment so the
    // buyer can retry via retryPayment().  Stock remains reserved.
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Payment could not be initiated. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Notifications and emails run in the background so checkout is not blocked by Brevo latency
  scheduleBackgroundWork(
    'checkout_post_order_notifications',
    async () => {
      const { createNotification, sendNotificationEmail } = await import('./notifications.server')
      const baseUrl = getBaseUrl()

      // Fetch buyer details and all order items for the buyer email
      const [buyerRecord] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, userId))
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
        .where(eq(shopOrder.platformOrderId, platformOrderId))

      const buyerItems = allOrderItems.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        price: formatPriceEUR(item.totalCents),
      }))

      const orderShopIds = result.createdShopOrders.map((so) => so.shopId)
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
                  orderShops.map((s) => s.ownerId),
                ),
              )
          : []
      const ownerEmailById = new Map(orderShopOwners.map((o) => [o.id, o.email]))
      const buyerSellerPayload =
        orderShops.length === 1
          ? toSellerEmailPayload(
              buildShopLegalIdentity({
                shopName: orderShops[0].name,
                ownerEmail: ownerEmailById.get(orderShops[0].ownerId) ?? '',
                vatId: orderShops[0].vatId,
                businessAddress: orderShops[0].businessAddress,
                shippingOrigin: orderShops[0].shippingOrigin,
              }),
            )
          : {}

      // Notify buyer
      await createNotification(userId, 'order_placed', {
        platformOrderId,
      })
      await sendNotificationEmail(userId, 'order_confirmation', {
        orderNumber: platformOrderId.slice(0, 8),
        buyerName: buyerRecord?.name,
        shopName: 'Eurtisan',
        items: buyerItems,
        total: formatPriceEUR(result.grandTotalCents),
        orderUrl: `${baseUrl}/orders/${platformOrderId}`,
        ...buyerSellerPayload,
      })

      // Index order items by shopName for O(1) lookup
      const orderItemsByShop = new Map<string, typeof allOrderItems>()
      for (const item of allOrderItems) {
        const list = orderItemsByShop.get(item.shopName) ?? []
        list.push(item)
        orderItemsByShop.set(item.shopName, list)
      }

      const shopById = new Map(orderShops.map((s) => [s.id, s]))
      const sellerById = new Map(orderShopOwners.map((o) => [o.id, o]))

      // Notify each seller (shops and owners already batch-fetched above)
      await Promise.all(
        result.createdShopOrders.map(async (so) => {
          const shopRecord = shopById.get(so.shopId)
          if (!shopRecord) return

          const shopItems = orderItemsByShop.get(shopRecord.name) ?? []
          const shopItemByName = new Map(shopItems.map((i) => [i.productName, i]))
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
              businessAddress: shopRecord.businessAddress,
              shippingOrigin: shopRecord.shippingOrigin,
            }),
          )

          await Promise.all([
            createNotification(shopRecord.ownerId, 'order_placed', {
              platformOrderId,
              shopOrderId: so.shopOrderId,
            }),
            sendNotificationEmail(shopRecord.ownerId, 'order_confirmation', {
              orderNumber: so.shopOrderId.slice(0, 8),
              buyerName: sellerRecord?.name ?? null,
              shopName: shopRecord.name,
              items: sellerItems,
              total: formatPriceEUR(
                sellerItems.reduce((sum, item) => {
                  const cents = shopItemByName.get(item.name)?.totalCents ?? 0
                  return sum + cents
                }, 0),
              ),
              orderUrl: `${baseUrl}/studio/${so.shopId}/orders/${so.shopOrderId}`,
              ...sellerPayload,
            }),
          ])
        }),
      )
    },
    { platformOrderId, userId },
  )

  ordersCreatedTotal.inc()
  logOrderCreated({
    platformOrderId,
    userId,
    totalCents: result.grandTotalCents,
    shopOrderCount: result.createdShopOrders.length,
  })

  return { platformOrderId, checkoutUrl }
}

/* -------------------------------------------------------------------------- */
/*                              retryPayment                                  */
/* -------------------------------------------------------------------------- */

export interface RetryPaymentResult {
  checkoutUrl: string
}

/**
 * Retry payment creation for an existing platform order that is still in
 * `pending_payment` status.  Useful when the original Mollie call failed
 * because of a transient network error or 5xx.
 */
export async function retryPayment(
  platformOrderId: string,
  userId: string,
  paymentProvider: PaymentProvider,
): Promise<RetryPaymentResult> {
  const [order] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (!order) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (order.userId !== userId) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (order.status !== 'pending_payment') {
    throw new Response(
      JSON.stringify({
        error: 'Conflict',
        message: 'Order is not in pending payment status',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const baseUrl = getBaseUrl()
  const redirectUrl = `${baseUrl}/orders/${platformOrderId}/success`
  const webhookUrl = `${baseUrl}/api/webhooks/mollie`

  let checkoutUrl: string

  const shippingAddress = order.shippingAddress as { country?: string } | null
  const buyerCountry = shippingAddress?.country

  try {
    const payment = await paymentProvider.createPayment(
      order.totalCents,
      'EUR',
      `Eurtisan order ${platformOrderId}`,
      redirectUrl,
      webhookUrl,
      buyerCountry,
    )

    await db
      .update(platformOrder)
      .set({ molliePaymentId: payment.paymentId, updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))

    checkoutUrl = payment.checkoutUrl
  } catch (_err) {
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Payment could not be initiated. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return { checkoutUrl }
}
