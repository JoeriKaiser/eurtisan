import { StarRating } from '#/components/ui/StarRating'
import type { ShopRatingSummary as RatingSummary } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'

export interface ShopRatingSummaryProps {
  /** Null when the shop has too few reviews to show a meaningful average. */
  rating: RatingSummary | null
  productCount: number
}

/**
 * Buyer rating, or the catalogue size when there is not enough evidence for one.
 *
 * The projection returns null below the review threshold rather than a thin
 * average, so an unproven shop shows what it does have — products — instead of
 * a number that would misrepresent it.
 */
export function ShopRatingSummary({ rating, productCount }: ShopRatingSummaryProps) {
  if (!rating) {
    return (
      <span className='text-sm text-text-secondary'>
        {m.shop_product_count({ count: productCount })}
      </span>
    )
  }

  return (
    <span className='flex items-center gap-2 text-sm text-text-secondary'>
      <StarRating rating={rating.ratingAverage} />
      <span className='font-medium text-text-primary tabular-nums'>
        {rating.ratingAverage.toFixed(1)}
      </span>
      <span aria-hidden='true'>·</span>
      <span>{m.shop_review_count({ count: rating.reviewCount })}</span>
    </span>
  )
}
