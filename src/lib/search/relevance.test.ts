import { describe, expect, it } from 'vitest'

import { computeBayesianRating, computePopularityScore, computeRatingAverage } from './relevance'

describe('computeBayesianRating', () => {
  it('returns the prior mean for an unreviewed product', () => {
    expect(computeBayesianRating({ reviewCount: 0, ratingSum: 0 })).toBe(3.5)
  })

  it('shrinks a single five-star review towards the prior', () => {
    const rating = computeBayesianRating({ reviewCount: 1, ratingSum: 5 })
    expect(rating).toBeGreaterThan(3.5)
    expect(rating).toBeLessThan(4)
  })

  it('converges on the observed mean as evidence accumulates', () => {
    const rating = computeBayesianRating({ reviewCount: 500, ratingSum: 2500 })
    expect(rating).toBeGreaterThan(4.9)
  })

  it('ranks a well-reviewed product above a single perfect review', () => {
    const onePerfect = computeBayesianRating({ reviewCount: 1, ratingSum: 5 })
    const manyGood = computeBayesianRating({ reviewCount: 200, ratingSum: 960 })
    expect(manyGood).toBeGreaterThan(onePerfect)
  })
})

describe('computeRatingAverage', () => {
  it('is zero when there are no reviews', () => {
    expect(computeRatingAverage({ reviewCount: 0, ratingSum: 0 })).toBe(0)
  })

  it('returns the arithmetic mean rounded to two decimals', () => {
    expect(computeRatingAverage({ reviewCount: 3, ratingSum: 13 })).toBe(4.33)
  })
})

describe('computePopularityScore', () => {
  it('rewards both rating quality and review volume', () => {
    const unreviewed = computePopularityScore({ reviewCount: 0, ratingSum: 0 })
    const oneFiveStar = computePopularityScore({ reviewCount: 1, ratingSum: 5 })
    const manyFiveStar = computePopularityScore({ reviewCount: 100, ratingSum: 500 })

    expect(oneFiveStar).toBeGreaterThan(unreviewed)
    expect(manyFiveStar).toBeGreaterThan(oneFiveStar)
  })

  it('ranks a poorly rated product below an unreviewed one', () => {
    const unreviewed = computePopularityScore({ reviewCount: 0, ratingSum: 0 })
    const badlyRated = computePopularityScore({ reviewCount: 20, ratingSum: 20 })
    expect(badlyRated).toBeLessThan(unreviewed)
  })

  it('is deterministic so stored scores never drift between writes', () => {
    const first = computePopularityScore({ reviewCount: 7, ratingSum: 30 })
    const second = computePopularityScore({ reviewCount: 7, ratingSum: 30 })
    expect(first).toBe(second)
  })

  it('tolerates a negative review count without producing NaN', () => {
    expect(Number.isFinite(computePopularityScore({ reviewCount: -1, ratingSum: 0 }))).toBe(true)
  })
})
