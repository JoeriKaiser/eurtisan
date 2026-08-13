/**
 * Pure relevance-scoring helpers for the products index.
 *
 * These values are computed at index time and stored on the document, so they
 * must be deterministic functions of data that changes through the sync queue.
 */

/** Rating assumed for a product before it has collected any reviews. */
const PRIOR_MEAN_RATING = 3.5

/** Strength of the prior, expressed as a number of "virtual" reviews. */
const PRIOR_WEIGHT = 5

export interface ReviewAggregate {
  reviewCount: number
  ratingSum: number
}

/**
 * Bayesian average rating. A lone five-star review must not outrank a product
 * with two hundred reviews averaging 4.8, so observed ratings are shrunk
 * towards the prior mean in proportion to how little evidence supports them.
 */
export function computeBayesianRating({ reviewCount, ratingSum }: ReviewAggregate): number {
  if (reviewCount <= 0) return PRIOR_MEAN_RATING
  return (PRIOR_WEIGHT * PRIOR_MEAN_RATING + ratingSum) / (PRIOR_WEIGHT + reviewCount)
}

/** Plain arithmetic mean, for display rather than ranking. Zero when unrated. */
export function computeRatingAverage({ reviewCount, ratingSum }: ReviewAggregate): number {
  if (reviewCount <= 0) return 0
  return Math.round((ratingSum / reviewCount) * 100) / 100
}

/**
 * Single numeric quality signal used as a Meilisearch custom ranking rule.
 *
 * Combines how well a product is rated with how much evidence backs that
 * rating, so a well-reviewed product outranks an unproven one on equal text
 * relevance. Recency is deliberately excluded: the score lives in the index and
 * a time-decaying value would silently go stale between writes. Sort by
 * `createdAt` for recency instead.
 */
export function computePopularityScore(aggregate: ReviewAggregate): number {
  const rating = computeBayesianRating(aggregate)
  const volume = Math.log10(Math.max(0, aggregate.reviewCount) + 1)
  return Math.round((rating * 20 + volume * 10) * 1000) / 1000
}
