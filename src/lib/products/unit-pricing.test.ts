import { describe, expect, it } from 'vitest'

import {
  deriveUnitPriceCents,
  isUnitPricingScoped,
  unitPriceBasisSchema,
  unitPricingMissing,
} from './unit-pricing'

describe('isUnitPricingScoped', () => {
  it('scopes Soap & Bath leaves through their root', () => {
    expect(isUnitPricingScoped(['bar-soap', 'soap-bath'])).toBe(true)
    expect(isUnitPricingScoped(['soap-bath'])).toBe(true)
  })

  it('does not scope unlisted categories', () => {
    expect(isUnitPricingScoped(['beeswax', 'candles'])).toBe(false)
    expect(isUnitPricingScoped([null])).toBe(false)
    expect(isUnitPricingScoped([])).toBe(false)
  })
})

describe('deriveUnitPriceCents', () => {
  it('prices per kilogram on the weight basis, VAT included', () => {
    // €12.50 for 250 g → €50.00/kg.
    expect(
      deriveUnitPriceCents({
        soldBy: 'weight',
        priceCents: 1250,
        weightGrams: 250,
        volumeMl: null,
      }),
    ).toBe(5000)
  })

  it('prices per litre on the volume basis', () => {
    // €9.00 for 300 ml → €30.00/L.
    expect(
      deriveUnitPriceCents({ soldBy: 'volume', priceCents: 900, weightGrams: null, volumeMl: 300 }),
    ).toBe(3000)
  })

  it('rounds half up to the cent', () => {
    // €4.99 for 300 g → 1663.3… → 1663.
    expect(
      deriveUnitPriceCents({ soldBy: 'weight', priceCents: 499, weightGrams: 300, volumeMl: null }),
    ).toBe(1663)
    // €2.00 for 300 g → 666.6… → 667.
    expect(
      deriveUnitPriceCents({ soldBy: 'weight', priceCents: 200, weightGrams: 300, volumeMl: null }),
    ).toBe(667)
  })

  it('waives the unit price when the net quantity is exactly one kilogram or litre', () => {
    expect(
      deriveUnitPriceCents({
        soldBy: 'weight',
        priceCents: 1200,
        weightGrams: 1000,
        volumeMl: null,
      }),
    ).toBeNull()
    expect(
      deriveUnitPriceCents({
        soldBy: 'volume',
        priceCents: 1200,
        weightGrams: null,
        volumeMl: 1000,
      }),
    ).toBeNull()
  })

  it('returns null without a basis or without the matching quantity', () => {
    expect(
      deriveUnitPriceCents({ soldBy: null, priceCents: 1200, weightGrams: 250, volumeMl: null }),
    ).toBeNull()
    expect(
      deriveUnitPriceCents({
        soldBy: 'weight',
        priceCents: 1200,
        weightGrams: null,
        volumeMl: null,
      }),
    ).toBeNull()
    expect(
      deriveUnitPriceCents({
        soldBy: 'volume',
        priceCents: 1200,
        weightGrams: 250,
        volumeMl: null,
      }),
    ).toBeNull()
  })

  it('accepts only the two bases', () => {
    expect(unitPriceBasisSchema.safeParse('weight').success).toBe(true)
    expect(unitPriceBasisSchema.safeParse('volume').success).toBe(true)
    expect(unitPriceBasisSchema.safeParse('piece').success).toBe(false)
  })
})

describe('unitPricingMissing', () => {
  it('flags scoped products lacking a declaration', () => {
    expect(
      unitPricingMissing({ scoped: true, soldBy: null, weightGrams: 250, volumeMl: null }),
    ).toBe(true)
    expect(
      unitPricingMissing({ scoped: true, soldBy: 'weight', weightGrams: null, volumeMl: null }),
    ).toBe(true)
    expect(
      unitPricingMissing({ scoped: true, soldBy: 'volume', weightGrams: null, volumeMl: null }),
    ).toBe(true)
  })

  it('accepts complete declarations and ignores unscoped products', () => {
    expect(
      unitPricingMissing({ scoped: true, soldBy: 'weight', weightGrams: 250, volumeMl: null }),
    ).toBe(false)
    expect(
      unitPricingMissing({ scoped: true, soldBy: 'volume', weightGrams: null, volumeMl: 300 }),
    ).toBe(false)
    expect(
      unitPricingMissing({ scoped: false, soldBy: null, weightGrams: null, volumeMl: null }),
    ).toBe(false)
  })
})
