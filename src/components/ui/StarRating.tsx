import { Star } from 'lucide-react'
import { m } from '#/paraglide/messages'

export interface StarRatingProps {
  /** Rating from 0 to 5. Values between whole numbers fill the nearest star. */
  rating: number
  /** Icon size in pixels. */
  size?: number
  /**
   * Overrides the screen-reader label. Use when the surrounding text already
   * announces the rating and repeating it would be noise.
   */
  label?: string
}

/**
 * Read-only star rating.
 *
 * Stars are decorative; the rating is announced once as text, because colour
 * and iconography alone may not carry meaning.
 */
export function StarRating({ rating, size = 14, label }: StarRatingProps) {
  const rounded = Math.round(rating)

  return (
    <span className='flex items-center gap-0.5'>
      <span className='sr-only'>{label ?? m.rating_out_of_five({ rating })}</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= rounded ? 'fill-warning text-warning' : 'text-[var(--ds-border-strong)]'
          }
          aria-hidden='true'
        />
      ))}
    </span>
  )
}

export default StarRating
