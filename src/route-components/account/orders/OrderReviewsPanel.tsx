import { Star } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { OrderShopGroup } from '#/lib/orders.server'
import type { ReviewableItem } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

export interface OrderReviewsPanelProps {
  shop: OrderShopGroup
  reviews: Record<string, ReviewableItem>
  onOpenReview: (item: ReviewableItem) => void
}

export function OrderReviewsPanel({ shop, reviews, onOpenReview }: OrderReviewsPanelProps) {
  return (
    <div className='rounded-lg border border-border-default bg-surface-inset p-3'>
      {shop.items.map((item) => {
        const reviewKey = `${shop.shopOrderId}-${item.productId}`
        const reviewable = reviews[reviewKey]
        if (!reviewable) return null
        return (
          <div
            key={item.id}
            className='flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0'
          >
            <span className='text-sm text-text-secondary truncate'>{item.productName}</span>
            {reviewable.hasReview ? (
              <span className='inline-flex items-center gap-1 text-xs font-medium text-success'>
                <Star size={14} fill='currentColor' aria-hidden='true' />
                {m.review_submitted()}
              </span>
            ) : reviewable.isEligible ? (
              <Button variant='secondary' size='sm' onClick={() => onOpenReview(reviewable)}>
                <Star size={14} className='mr-1' aria-hidden='true' />
                {m.order_detail_review()}
              </Button>
            ) : (
              <Button
                variant='secondary'
                size='sm'
                disabled
                title={m.order_detail_review_disabled_tooltip({
                  days: String(reviewable.daysRemaining ?? 0),
                })}
              >
                <Star size={14} className='mr-1' aria-hidden='true' />
                {m.order_detail_review_disabled({
                  date: reviewable.daysRemaining
                    ? m.review_days_remaining({
                        days: String(reviewable.daysRemaining),
                      })
                    : '',
                })}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
