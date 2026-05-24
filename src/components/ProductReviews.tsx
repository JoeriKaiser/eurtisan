import { ChevronLeft, ChevronRight, MessageSquare, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getProductReviews } from '#/lib/reviews'
import type { ProductReviewsResult } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

export interface ProductReviewsProps {
  productId: string
}

function formatReviewDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className='flex items-center gap-0.5' role='img' aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={
            star <= rating
              ? 'fill-[--palette-ochre-400] text-[--palette-ochre-400]'
              : 'text-[var(--ds-border-strong)]'
          }
          aria-hidden='true'
        />
      ))}
    </span>
  )
}

function DistributionBar({
  rating,
  count,
  total,
}: {
  rating: number
  count: number
  total: number
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  return (
    <div className='flex items-center gap-2 text-sm'>
      <span className='w-3 text-right tabular-nums text-[var(--ds-text-muted)]'>{rating}</span>
      <Star size={12} className='text-[--palette-ochre-400]' aria-hidden='true' />
      <div className='flex-1 h-2 rounded-full bg-[var(--ds-border-subtle)] overflow-hidden'>
        <svg
          className='h-full w-full'
          preserveAspectRatio='none'
          viewBox='0 0 100 1'
          aria-hidden='true'
        >
          <rect width={percentage} height='1' className='fill-[--palette-ochre-400]' />
        </svg>
      </div>
      <span className='w-6 text-right tabular-nums text-[var(--ds-text-muted)] text-xs'>
        {count}
      </span>
    </div>
  )
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ProductReviewsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await getProductReviews({
          data: { productId, page, pageSize: 10 },
        })
        if (!cancelled) {
          setData(result)
        }
      } catch {
        if (!cancelled) {
          setError(m.reviews_load_error())
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [page, productId])

  if (loading && !data) {
    return (
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='animate-pulse space-y-4'>
          <div className='size-6 bg-[var(--ds-border-subtle)] rounded' />
          <div className='h-20 w-full bg-[var(--ds-border-subtle)] rounded' />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <p className='text-sm text-[var(--ds-error)]'>{error}</p>
      </section>
    )
  }

  if (!data || data.total === 0) {
    return (
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h2 className='mb-4 text-lg font-semibold text-[var(--ds-text-primary)]'>
          {m.reviews_title()}
        </h2>
        <div className='flex flex-col items-center justify-center py-10 text-center'>
          <MessageSquare
            size={40}
            className='mb-3 text-[var(--ds-text-muted)]'
            aria-hidden='true'
          />
          <p className='text-base font-medium text-[var(--ds-text-secondary)]'>
            {m.reviews_empty_title()}
          </p>
          <p className='mt-1 text-sm text-[var(--ds-text-muted)]'>
            {m.reviews_empty_description()}
          </p>
        </div>
      </section>
    )
  }

  const hasPrev = data.page > 1
  const hasNext = data.page < data.totalPages

  return (
    <section className='island-shell rounded-2xl p-6 sm:p-8'>
      <h2 className='mb-6 text-lg font-semibold text-[var(--ds-text-primary)]'>
        {m.reviews_title()}
      </h2>

      {/* Summary */}
      <div className='mb-8 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start'>
        {/* Average rating */}
        <div className='flex flex-col items-center justify-center rounded-xl bg-[var(--ds-bg-inset)] px-6 py-5'>
          <span className='text-4xl font-bold text-[var(--ds-text-primary)]'>
            {data.averageRating?.toFixed(1) ?? '0.0'}
          </span>
          <div className='mt-1'>
            <StarRating rating={Math.round(data.averageRating ?? 0)} />
          </div>
          <span className='mt-1.5 text-sm text-[var(--ds-text-muted)]'>
            {m.reviews_count({ count: String(data.total) })}
          </span>
        </div>

        {/* Distribution */}
        <div className='space-y-1.5 self-center'>
          {data.distribution.map((d) => (
            <DistributionBar key={d.rating} rating={d.rating} count={d.count} total={data.total} />
          ))}
        </div>
      </div>

      {/* Review list */}
      <div className='space-y-4'>
        {data.reviews.map((review) => (
          <article
            key={review.id}
            className='rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-default)] p-4 sm:p-5'
          >
            <div className='flex items-center justify-between gap-4 mb-2'>
              <div className='flex items-center gap-2 min-w-0'>
                <div className='flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-primary-subtle)] text-sm font-semibold text-[var(--ds-accent-primary)]'>
                  {review.buyerName.charAt(0).toUpperCase()}
                </div>
                <span className='truncate text-sm font-medium text-[var(--ds-text-primary)]'>
                  {review.buyerName}
                </span>
              </div>
              <time className='flex-shrink-0 text-xs text-[var(--ds-text-muted)]'>
                {formatReviewDate(review.createdAt)}
              </time>
            </div>
            <div className='mb-2 ml-10'>
              <StarRating rating={review.rating} />
            </div>
            {review.comment && (
              <p className='ml-10 text-sm text-[var(--ds-text-secondary)] leading-relaxed whitespace-pre-wrap'>
                {review.comment}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className='mt-6 flex items-center justify-between border-t border-[var(--ds-border-subtle)] pt-4'>
          <button
            type='button'
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev || loading}
            className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-bg-inset)] disabled:cursor-not-allowed disabled:opacity-40'
          >
            <ChevronLeft size={16} aria-hidden='true' />
            {m.pagination_previous()}
          </button>
          <span className='text-sm text-[var(--ds-text-muted)]'>
            {m.pagination_page_of({ page: String(data.page), totalPages: String(data.totalPages) })}
          </span>
          <button
            type='button'
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext || loading}
            className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-bg-inset)] disabled:cursor-not-allowed disabled:opacity-40'
          >
            {m.pagination_next()}
            <ChevronRight size={16} aria-hidden='true' />
          </button>
        </div>
      )}
    </section>
  )
}
