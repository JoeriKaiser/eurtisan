import { EU_MEMBER_STATE_CODES } from '../address-validation'
import { getEnableViesValidation } from '../env.server'
import { isVatIdFormatValid } from '../vat-patterns'
import { calculateVat, normalizeCountryCode, verifyVatIdVies } from '../vat.server'

export type CheckoutVatRateCategory = 'standard' | 'reduced' | 'exempt'

export interface CheckoutTaxContext {
  sellerCountry: string
  buyerCountry: string
  isSellerVatRegistered: boolean
  buyerVatId?: string | null
  /**
   * Use when eligibility is determined from a distinct billing address while
   * the applicable destination rate still uses the shipping address.
   */
  reverseChargeApplies?: boolean
}

export interface CheckoutLineTotals {
  lineTotalCents: number
  unitPriceCents: number
  vatAmountCents: number
  vatRateBasisPoints: number
}

export interface CheckoutShippingTotals {
  shippingCostCents: number
  vatAmountCents: number
  vatRateBasisPoints: number
}

/**
 * Determine whether a sale qualifies for the EU cross-border B2B
 * reverse-charge treatment.
 */
export function isCrossBorderB2b(
  sellerCountryCode: string,
  buyerCountryCode: string,
  isSellerVatRegistered: boolean,
  buyerVatId?: string | null,
): boolean {
  if (!isSellerVatRegistered || !buyerVatId) return false

  const seller = normalizeCountryCode(sellerCountryCode)
  const buyer = normalizeCountryCode(buyerCountryCode)
  if (!seller || !buyer || seller === buyer) return false

  const euCountries = EU_MEMBER_STATE_CODES as readonly string[]
  return euCountries.includes(seller) && euCountries.includes(buyer)
}

/**
 * Verify a VAT ID only when it determines the applicable tax treatment.
 * Offline validation always applies; VIES verification remains opt-in through
 * the existing environment configuration.
 */
export async function validateCrossBorderBuyerVatId(
  sellerCountryCode: string,
  buyerCountryCode: string,
  isSellerVatRegistered: boolean,
  buyerVatId?: string | null,
): Promise<void> {
  if (
    !isCrossBorderB2b(sellerCountryCode, buyerCountryCode, isSellerVatRegistered, buyerVatId) ||
    !buyerVatId
  ) {
    return
  }

  if (!isVatIdFormatValid(buyerVatId, buyerCountryCode)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `Invalid VAT ID format for country ${buyerCountryCode}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (getEnableViesValidation()) {
    const isValid = await verifyVatIdVies(buyerVatId, buyerCountryCode)
    if (!isValid) {
      throw new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'VAT ID could not be verified. Please check the number or try again later.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }
}

/**
 * Produce immutable line-item amounts from the tax context. Prices are stored
 * tax-inclusive, so reverse-charge calculations extract the seller's domestic
 * VAT before persisting the order line.
 */
export function calculateCheckoutLineTotals(
  context: CheckoutTaxContext & {
    vatRateCategory: CheckoutVatRateCategory
    unitPriceCents: number
    quantity: number
  },
): CheckoutLineTotals {
  const inclusiveAmountCents = context.unitPriceCents * context.quantity
  const reverseChargeApplies =
    context.reverseChargeApplies ??
    isCrossBorderB2b(
      context.sellerCountry,
      context.buyerCountry,
      context.isSellerVatRegistered,
      context.buyerVatId,
    )

  if (reverseChargeApplies) {
    const domesticVat = calculateVat({
      sellerCountry: context.sellerCountry,
      buyerCountry: context.sellerCountry,
      isVatRegistered: context.isSellerVatRegistered,
      vatRateCategory: context.vatRateCategory,
      inclusiveAmountCents,
    })
    const lineTotalCents = inclusiveAmountCents - domesticVat.vatAmountCents

    return {
      lineTotalCents,
      unitPriceCents: Math.round(lineTotalCents / context.quantity),
      vatAmountCents: 0,
      vatRateBasisPoints: 0,
    }
  }

  const vat = calculateVat({
    sellerCountry: context.sellerCountry,
    buyerCountry: context.buyerCountry,
    isVatRegistered: context.isSellerVatRegistered,
    vatRateCategory: context.vatRateCategory,
    inclusiveAmountCents,
  })

  return {
    lineTotalCents: inclusiveAmountCents,
    unitPriceCents: context.unitPriceCents,
    vatAmountCents: vat.vatAmountCents,
    vatRateBasisPoints: vat.vatRateBasisPoints,
  }
}

/**
 * Compute the persisted shipping cost and its VAT fields using the same tax
 * treatment as order lines.
 */
export function calculateCheckoutShippingTotals(
  context: CheckoutTaxContext & { shippingCostCents: number },
): CheckoutShippingTotals {
  const reverseChargeApplies =
    context.reverseChargeApplies ??
    isCrossBorderB2b(
      context.sellerCountry,
      context.buyerCountry,
      context.isSellerVatRegistered,
      context.buyerVatId,
    )

  if (reverseChargeApplies) {
    const domesticVat = calculateVat({
      sellerCountry: context.sellerCountry,
      buyerCountry: context.sellerCountry,
      isVatRegistered: context.isSellerVatRegistered,
      vatRateCategory: 'standard',
      inclusiveAmountCents: context.shippingCostCents,
    })

    return {
      shippingCostCents: context.shippingCostCents - domesticVat.vatAmountCents,
      vatAmountCents: 0,
      vatRateBasisPoints: 0,
    }
  }

  const vat = calculateVat({
    sellerCountry: context.sellerCountry,
    buyerCountry: context.buyerCountry,
    isVatRegistered: context.isSellerVatRegistered,
    vatRateCategory: 'standard',
    inclusiveAmountCents: context.shippingCostCents,
  })

  return {
    shippingCostCents: context.shippingCostCents,
    vatAmountCents: vat.vatAmountCents,
    vatRateBasisPoints: vat.vatRateBasisPoints,
  }
}
