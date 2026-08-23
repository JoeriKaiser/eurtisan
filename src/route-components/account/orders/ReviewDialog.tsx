import { Star, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { createReview } from '#/lib/reviews'
import type { ReviewableItem } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

export interface ReviewDialogProps {
  item: ReviewableItem
  onClose: () => void
  onSubmitted: (reviewKey: string) => void
}

export function ReviewDialog({ item, onClose, onSubmitted }: ReviewDialogProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmitReview = async () => {
    if (rating < 1 || rating > 5) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createReview({
        data: {
          shopOrderId: item.shopOrderId,
          productId: item.productId,
          rating,
          comment: comment.trim() || null,
        },
      })
      onSubmitted(`${item.shopOrderId}-${item.productId}`)
      onClose()
    } catch (err) {
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({ message: 'Unknown error' }))
        setSubmitError(body.message || 'Failed to submit review')
      } else {
        setSubmitError('Failed to submit review')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <div className='flex items-center justify-between'>
            <DialogTitle>{m.review_modal_title()}</DialogTitle>
            <button
              type='button'
              onClick={onClose}
              className='rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary'
              aria-label={m.review_modal_close()}
            >
              <X size={18} aria-hidden='true' />
            </button>
          </div>
          <DialogDescription>{m.review_modal_description()}</DialogDescription>

          <div className='mt-4 space-y-4'>
            <p className='text-sm font-medium text-text-primary'>{item.productName}</p>

            {/* Star Rating */}
            <div className='flex items-center justify-center gap-1'>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type='button'
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className='rounded p-0.5 transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/40'
                  aria-label={m.review_star_label({ star: String(star) })}
                >
                  <Star
                    size={28}
                    className={`transition-colors ${
                      (hoverRating ? star <= hoverRating : star <= rating)
                        ? 'fill-warning text-warning'
                        : 'text-text-muted'
                    }`}
                    aria-hidden='true'
                  />
                </button>
              ))}
            </div>
            <p className='text-center text-xs text-text-secondary'>
              {rating > 0
                ? m.review_rating_selected({ rating: String(rating) })
                : m.review_rating_prompt()}
            </p>

            {/* Comment */}
            <div>
              <label
                htmlFor='review-comment'
                className='mb-1 block text-sm font-medium text-text-primary'
              >
                {m.review_comment_label()}
              </label>
              <textarea
                id='review-comment'
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={m.review_comment_placeholder()}
                aria-label={m.review_comment_label()}
                className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
                maxLength={2000}
                disabled={isSubmitting}
              />
              <p className='mt-1 text-right text-xs text-text-muted'>{comment.length}/2000</p>
            </div>

            {submitError && <p className='text-sm text-error'>{submitError}</p>}

            <div className='flex justify-end gap-3'>
              <Button variant='secondary' onClick={onClose} disabled={isSubmitting}>
                {m.review_cancel()}
              </Button>
              <Button
                onClick={handleSubmitReview}
                isLoading={isSubmitting}
                disabled={rating < 1 || isSubmitting}
              >
                {m.review_submit()}
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
