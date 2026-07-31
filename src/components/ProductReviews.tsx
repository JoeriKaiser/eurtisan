import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Flag, MessageSquare, Star } from 'lucide-react'
import { useState } from 'react'
import { ReportReviewDialog } from '#/components/reviews/ReportReviewDialog'
import { ReviewDisclosure } from '#/components/reviews/ReviewDisclosure'
import { StarRating } from '#/components/ui/StarRating'
import { useAuth } from '#/lib/auth-hooks'
import { getProductReviews, reportReview } from '#/lib/reviews'
import type { ProductReviewsResult, ReviewReportReason } from '#/lib/reviews.server'
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
      <Star size={12} className='fill-warning text-warning' aria-hidden='true' />
      <div className='flex-1 h-2 rounded-full bg-[var(--ds-border-subtle)] overflow-hidden'>
        <svg
          className='h-full w-full'
          preserveAspectRatio='none'
          viewBox='0 0 100 1'
          aria-hidden='true'
        >
          <rect width={percentage} height='1' className='fill-warning' />
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
  const { user } = useAuth()
  const [reportedReviews, setReportedReviews] = useState<Record<string, boolean>>({})
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<ProductReviewsResult>({
    queryKey: ['product-reviews', productId, page],
    queryFn: async () =>
      getProductReviews({
        data: { productId, page, pageSize: 10 },
      }),
    placeholderData: (previousData) => previousData,
  })

  const handleReport = async (reason: ReviewReportReason, details: string | null) => {
    if (!reportingId) return
    setReportBusy(true)
    setReportError(null)
    try {
      await reportReview({ data: { reviewId: reportingId, reason, details } })
      // A repeat notice from the same person reports the same success: it is
      // already on record, and saying otherwise would invite them to try again.
      setReportedReviews((prev) => ({ ...prev, [reportingId]: true }))
      setReportingId(null)
    } catch {
      setReportError(m.review_report_error())
    } finally {
      setReportBusy(false)
    }
  }

  if (isLoading && !data) {
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
        <p className='text-sm text-[var(--ds-error)]'>{m.reviews_load_error()}</p>
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
        {/* Shown even with no reviews: the verification claim is about how
            reviews get here, which a buyer may want before they buy. */}
        <ReviewDisclosure />
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
            {/* Pluralised through the message format, not a ternary: Dutch
                plural rules differ from English and a ternary hardcodes one. */}
            {m.reviews_count({ count: data.total })}
          </span>
        </div>

        {/* Distribution */}
        <div className='space-y-1.5 self-center'>
          {data.distribution.map((d) => (
            <DistributionBar key={d.rating} rating={d.rating} count={d.count} total={data.total} />
          ))}
        </div>
      </div>

      <ReviewDisclosure />

      {/* Review list */}
      <div className='mt-6 space-y-4'>
        {data.reviews.map((review) => (
          <article
            key={review.id}
            className='rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-default)] p-4 sm:p-5'
          >
            <div className='flex items-center justify-between gap-4 mb-2'>
              <div className='flex items-center gap-2 min-w-0'>
                <div className='flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ds-accent-primary-subtle)] text-sm font-semibold text-[var(--ds-accent-primary)]'>
                  {(review.buyerName || m.reviews_anonymous_buyer()).charAt(0).toUpperCase()}
                </div>
                <span className='truncate text-sm font-medium text-[var(--ds-text-primary)]'>
                  {review.buyerName || m.reviews_anonymous_buyer()}
                </span>
              </div>
              <div className='flex items-center gap-2 flex-shrink-0'>
                <div className='text-right'>
                  <time
                    className='block text-xs text-[var(--ds-text-muted)]'
                    dateTime={new Date(review.createdAt).toISOString()}
                  >
                    {formatReviewDate(review.createdAt)}
                  </time>
                  {/* The date of the experience, next to the date of
                      publication, as C. consom. L.111-7-2 requires. */}
                  {review.experiencedAt && (
                    <time
                      className='block text-xs text-[var(--ds-text-muted)]'
                      dateTime={new Date(review.experiencedAt).toISOString()}
                    >
                      {m.reviews_experienced_at({ date: formatReviewDate(review.experiencedAt) })}
                    </time>
                  )}
                </div>
                {user && (
                  <button
                    type='button'
                    onClick={() => {
                      setReportError(null)
                      setReportingId(review.id)
                    }}
                    disabled={reportedReviews[review.id]}
                    className='rounded p-1 text-[var(--ds-text-muted)] hover:bg-[var(--ds-bg-inset)] hover:text-[var(--ds-error)] transition disabled:opacity-50 disabled:cursor-not-allowed'
                    title={
                      reportedReviews[review.id]
                        ? m.reviews_report_success()
                        : m.reviews_report_button()
                    }
                    aria-label={
                      reportedReviews[review.id]
                        ? m.reviews_report_success()
                        : m.reviews_report_button()
                    }
                  >
                    <Flag
                      size={14}
                      className={
                        reportedReviews[review.id]
                          ? 'fill-[var(--ds-error)] text-[var(--ds-error)]'
                          : ''
                      }
                    />
                  </button>
                )}
              </div>
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

      <ReportReviewDialog
        open={reportingId !== null}
        onOpenChange={(open) => {
          if (!open) setReportingId(null)
        }}
        busy={reportBusy}
        error={reportError}
        onSubmit={handleReport}
      />

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className='mt-6 flex items-center justify-between border-t border-[var(--ds-border-subtle)] pt-4'>
          <button
            type='button'
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev || isLoading}
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
            disabled={!hasNext || isLoading}
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
