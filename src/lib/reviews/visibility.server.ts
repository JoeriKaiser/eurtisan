import { eq } from 'drizzle-orm'
import { review } from '#/db/schema'

/**
 * The one predicate deciding whether a review counts towards anything public.
 *
 * Three call sites used to disagree. The product page and the shop aggregate
 * counted everything not `hidden`; search's `popularityScore` counted `approved`
 * only. So a review could be visible in the displayed average and absent from
 * the ranking at the same time, and the storefront's trust signal could
 * contradict search.
 *
 * Converged on `approved` rather than picking the wider filter, because
 * `flagged` now means something it did not before. Reporting no longer changes
 * moderation state — only an admin does, after a decision, with a statement of
 * reasons sent under DSA Article 17. A `flagged` review is therefore one a human
 * looked at and had doubts about, and such a review should not prop up an
 * average it is not trusted enough to rank with.
 *
 * `src/test/review-visibility.test.ts` fails if a fourth call site invents a
 * fifth convention.
 */
export const PUBLIC_REVIEW_FILTER = eq(review.moderationStatus, 'approved')
