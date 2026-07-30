import { describe, expect, it } from 'vitest'
import {
  SHOP_PROFILE_SCORED_FIELDS,
  scoreShopProfileCompleteness,
  type ShopProfileFieldPresence,
} from './public-profile'

function presence(overrides: Partial<ShopProfileFieldPresence> = {}): ShopProfileFieldPresence {
  const base = Object.fromEntries(
    SHOP_PROFILE_SCORED_FIELDS.map((field) => [field, false]),
  ) as ShopProfileFieldPresence
  return { ...base, ...overrides }
}

describe('scoreShopProfileCompleteness', () => {
  it('scores an empty profile at zero', () => {
    expect(scoreShopProfileCompleteness(presence())).toBe(0)
  })

  it('scores a fully populated profile at one', () => {
    const everything = Object.fromEntries(
      SHOP_PROFILE_SCORED_FIELDS.map((field) => [field, true]),
    ) as ShopProfileFieldPresence

    expect(scoreShopProfileCompleteness(everything)).toBe(1)
  })

  it('is the fraction of scored fields present', () => {
    const half = presence(
      Object.fromEntries(
        SHOP_PROFILE_SCORED_FIELDS.slice(0, SHOP_PROFILE_SCORED_FIELDS.length / 2).map((field) => [
          field,
          true,
        ]),
      ),
    )

    expect(scoreShopProfileCompleteness(half)).toBe(0.5)
  })

  it('always lands inside the histogram range', () => {
    // The buckets stop at 1; a score above it would fall in +Inf and be
    // indistinguishable from a broken measure.
    for (const field of SHOP_PROFILE_SCORED_FIELDS) {
      const score = scoreShopProfileCompleteness(presence({ [field]: true }))
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('does not score mandatory or boolean fields, which would inflate every shop', () => {
    // `name` and `slug` are always set, and `isVatRegistered` /
    // `hasProductionPartner` are booleans where false is a real answer. Scoring
    // any of them would move every shop's number without telling us anything.
    const scored = SHOP_PROFILE_SCORED_FIELDS as readonly string[]
    for (const field of [
      'name',
      'slug',
      'createdAt',
      'isVatRegistered',
      'hasProductionPartner',
      'productionPartnerDetails',
      'productCount',
      'rating',
    ]) {
      expect(scored).not.toContain(field)
    }
  })
})
