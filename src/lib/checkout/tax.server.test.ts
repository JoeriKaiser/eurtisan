import { describe, expect, it } from 'vitest'
import {
  calculateCheckoutLineTotals,
  calculateCheckoutShippingTotals,
  isCrossBorderB2b,
} from './tax.server'

describe('checkout tax calculations', () => {
  it('uses the destination VAT rate for a registered B2C sale', () => {
    const totals = calculateCheckoutLineTotals({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      isSellerVatRegistered: true,
      vatRateCategory: 'standard',
      unitPriceCents: 1200,
      quantity: 1,
    })

    expect(totals).toEqual({
      lineTotalCents: 1200,
      unitPriceCents: 1200,
      vatAmountCents: 200,
      vatRateBasisPoints: 2000,
    })
  })

  it('extracts domestic VAT for a valid cross-border B2B reverse charge', () => {
    const totals = calculateCheckoutLineTotals({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      isSellerVatRegistered: true,
      buyerVatId: 'FR12345678901',
      vatRateCategory: 'standard',
      unitPriceCents: 1190,
      quantity: 2,
    })

    expect(isCrossBorderB2b('DE', 'FR', true, 'FR12345678901')).toBe(true)
    expect(totals).toEqual({
      lineTotalCents: 2000,
      unitPriceCents: 1000,
      vatAmountCents: 0,
      vatRateBasisPoints: 0,
    })
  })

  it('honours billing-address reverse-charge eligibility when shipping differs', () => {
    const totals = calculateCheckoutLineTotals({
      sellerCountry: 'DE',
      buyerCountry: 'DE',
      isSellerVatRegistered: true,
      buyerVatId: 'FR12345678901',
      reverseChargeApplies: true,
      vatRateCategory: 'standard',
      unitPriceCents: 1190,
      quantity: 1,
    })

    expect(totals).toMatchObject({
      lineTotalCents: 1000,
      vatAmountCents: 0,
      vatRateBasisPoints: 0,
    })
  })

  it('applies the same reverse-charge treatment to shipping', () => {
    const totals = calculateCheckoutShippingTotals({
      sellerCountry: 'DE',
      buyerCountry: 'FR',
      isSellerVatRegistered: true,
      buyerVatId: 'FR12345678901',
      shippingCostCents: 1190,
    })

    expect(totals).toEqual({
      shippingCostCents: 1000,
      vatAmountCents: 0,
      vatRateBasisPoints: 0,
    })
  })
})
