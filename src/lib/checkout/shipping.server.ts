import type {
  Package,
  Rate,
  ShippingAddress as ProviderShippingAddress,
  ShippingProvider,
  ServicePoint,
} from '#/integrations/shipping'
import { getShippingProvider } from '#/integrations/shipping'
import { calculatePackageFromItems } from '../shipping-estimate'
import type { CheckoutItem, ShippingAddress, ShippingOption, ShippingSelection } from './types'

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
  code: 'SHIPPING_UNSUPPORTED',
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
        supportsServicePoint: rate.supportsServicePoint,
      }) satisfies ShippingOption,
  )
}

/**
 * Resolve shipping options for a single shop in the cart.
 *
 * Calls the active shipping provider when a shipping address is available;
 * falls back to manual options when the provider is unavailable or the
 * destination is unsupported. The optional provider is a deterministic test
 * seam and is never supplied by browser-callable contracts.
 */
export async function getShippingOptionsForShop(
  items: CheckoutItem[],
  shippingAddress?: ShippingAddress,
  origin?: ProviderShippingAddress,
  shippingProvider?: ShippingProvider,
): Promise<ShippingOption[]> {
  if (!shippingAddress) {
    return FALLBACK_SHIPPING_OPTIONS
  }

  const pkg: Package = calculatePackageFromItems(items)
  const effectiveOrigin = origin ?? getPlatformOrigin()
  const destination: ProviderShippingAddress = {
    street: shippingAddress.street,
    city: shippingAddress.city,
    postalCode: shippingAddress.postalCode,
    country: shippingAddress.country,
    company: shippingAddress.name,
  }

  try {
    const provider = shippingProvider ?? getShippingProvider()
    const rates = await provider.getRates(effectiveOrigin, destination, pkg)
    if (rates.length === 0) {
      return [UNSUPPORTED_FALLBACK]
    }
    return ratesToShippingOptions(rates)
  } catch {
    return FALLBACK_SHIPPING_OPTIONS
  }
}

/**
 * Get the shipping cost in cents for a given shipping method and available
 * options. Used by checkout persistence to compute the server-verified total.
 */
export function getShippingCostFromOptions(
  options: ShippingOption[],
  method: 'standard' | 'express' | 'manual',
  rateId?: string,
): number {
  const option =
    options.find((option) => option.rateId === rateId) ??
    options.find((option) => option.method === method) ??
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

/**
 * Choose the quote that the checkout summary should use for a selection. A
 * non-fallback rate is preferred when the buyer has not yet made a selection.
 */
export function getSelectedShippingOption(
  options: ShippingOption[],
  selection?: ShippingSelection,
): ShippingOption | undefined {
  if (selection) {
    return (
      options.find((option) => option.rateId === selection.rateId) ??
      options.find((option) => option.method === selection.method) ??
      options.find((option) => !option.fallback) ??
      options[0]
    )
  }

  return options.find((option) => !option.fallback) ?? options[0]
}

/**
 * Select the quote used for a VAT estimate. This deliberately retains the
 * prior map semantics (the last option for a duplicate key) while
 * `getSelectedShippingOption` retains first-match semantics for the displayed
 * grand total.
 */
export function getShippingOptionForVatEstimate(
  options: ShippingOption[],
  selection?: ShippingSelection,
): ShippingOption | undefined {
  const optionByRateId = new Map(options.map((option) => [option.rateId, option]))
  const optionByMethod = new Map(options.map((option) => [option.method, option]))
  const optionByFallback = new Map(options.map((option) => [option.fallback, option])).get(false)

  if (selection) {
    return (
      optionByRateId.get(selection.rateId) ??
      optionByMethod.get(selection.method) ??
      optionByFallback ??
      options[0]
    )
  }

  return optionByFallback ?? options[0]
}

export interface CheckoutShippingShop {
  shopId: string
  items: CheckoutItem[]
  origin?: ProviderShippingAddress
}

/**
 * Retrieve service points through the active provider. The contract handler
 * validates caller input and rate-limits requests; this server-only helper
 * keeps provider access alongside the other checkout shipping operations.
 */
export async function getCheckoutServicePoints(
  postalCode: string,
  country: string,
  carrier?: string,
  shippingProvider?: ShippingProvider,
): Promise<ServicePoint[]> {
  const provider = shippingProvider ?? getShippingProvider()
  return provider.getServicePoints(postalCode, country, carrier)
}

/**
 * Fetch fresh carrier quotes and validate every client-provided selection.
 * The resulting map contains only authoritative carrier costs, never the
 * client-supplied totals.
 */
export async function validateCheckoutShippingSelections(
  shops: readonly CheckoutShippingShop[],
  shippingAddress: ShippingAddress,
  shippingSelections: readonly ShippingSelection[],
  shippingProvider?: ShippingProvider,
): Promise<Map<string, number>> {
  const shippingEntries = await Promise.all(
    shops.map(async (shop) => {
      const options = await getShippingOptionsForShop(
        shop.items,
        shippingAddress,
        shop.origin,
        shippingProvider,
      )
      return [shop.shopId, options] as const
    }),
  )
  const shippingOptionsByShop = new Map<string, ShippingOption[]>(shippingEntries)

  const selectionMap = new Map<string, ShippingSelection>()
  for (const selection of shippingSelections) {
    selectionMap.set(selection.shopId, selection)
  }

  for (const shop of shops) {
    const selection = selectionMap.get(shop.shopId)
    if (!selection) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Missing shipping selection for shop ${shop.shopId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const options = shippingOptionsByShop.get(shop.shopId) ?? []
    const matchingOption =
      selection.rateId !== undefined
        ? options.find((option) => option.rateId === selection.rateId)
        : options.find((option) => option.method === selection.method)

    if (!matchingOption) {
      const hasRealOption = options.some((option) => !option.fallback)
      if (!hasRealOption && options.length > 0) {
        const fallbackOption = options[0]
        if (fallbackOption.code === 'SHIPPING_UNSUPPORTED') {
          throw new Response(
            JSON.stringify({
              error: 'Unprocessable',
              code: 'SHIPPING_UNSUPPORTED',
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
          message: `Invalid shipping selection for shop ${shop.shopId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (matchingOption.fallback && matchingOption.code === 'SHIPPING_UNSUPPORTED') {
      throw new Response(
        JSON.stringify({
          error: 'Unprocessable',
          code: 'SHIPPING_UNSUPPORTED',
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
          message: `Shipping cost mismatch for shop ${shop.shopId}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (matchingOption.supportsServicePoint) {
      const point = shippingAddress.pickupPoint
      if (!point) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Request',
            message: `Pick-up point required for shop ${shop.shopId}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const provider = shippingProvider ?? getShippingProvider()
      const servicePointMethods = await provider.getServicePointMethods(point.id)
      const methodIds = new Set(servicePointMethods.map((method) => method.rateId))
      if (!methodIds.has(selection.rateId ?? '')) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Request',
            message: `Selected shipping method does not support the chosen pick-up point for shop ${shop.shopId}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
  }

  const shippingCostByShop = new Map<string, number>()
  for (const shop of shops) {
    const selection = selectionMap.get(shop.shopId)
    if (!selection) continue
    const options = shippingOptionsByShop.get(shop.shopId) ?? []
    shippingCostByShop.set(
      shop.shopId,
      getShippingCostFromOptions(options, selection.method, selection.rateId),
    )
  }

  return shippingCostByShop
}
