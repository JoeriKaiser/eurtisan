import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Flag, MessageSquare, Star, ThumbsUp } from 'lucide-react'
import { useId, useState } from 'react'
import { ReportReviewDialog } from '#/components/reviews/ReportReviewDialog'
import { ReviewDisclosure } from '#/components/reviews/ReviewDisclosure'
import { SellerReplySection } from '#/components/reviews/SellerReplySection'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Select } from '#/components/ui/select'
import { StarRating } from '#/components/ui/StarRating'
import { useAuth } from '#/lib/auth-hooks'
import { getProductReviews, reportReview, setReviewHelpful } from '#/lib/reviews'
import type { ProductReviewsResult, ReviewReportReason, ReviewSort } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'

export interface ProductReviewsProps {
  productId: string
}

type RatingFilter = 1 | 2 | 3 | 4 | 5 | undefined

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
      <span className='w-3 text-right tabular-nums text-text-muted'>{rating}</span>
      <Star size={12} className='fill-warning text-warning' aria-hidden='true' />
      <div className='h-2 flex-1 overflow-hidden rounded-full bg-border-subtle'>
        <svg
          className='h-full w-full'
          preserveAspectRatio='none'
          viewBox='0 0 100 1'
          aria-hidden='true'
        >
          <rect width={percentage} height='1' className='fill-warning' />
        </svg>
      </div>
      <span className='w-6 text-right text-xs tabular-nums text-text-muted'>{count}</span>
    </div>
  )
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<ReviewSort>('newest')
  const [rating, setRating] = useState<RatingFilter>(undefined)
  const sortId = useId()
  const ratingId = useId()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [reportedReviews, setReportedReviews] = useState<Record<string, boolean>>({})
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [helpfulBusyId, setHelpfulBusyId] = useState<string | null>(null)
  const [helpfulErrors, setHelpfulErrors] = useState<Record<string, string | null>>({})

  const { data, isLoading, isFetching, error } = useQuery<ProductReviewsResult>({
    queryKey: ['product-reviews', productId, page, sort, rating ?? 'all'],
    queryFn: async () =>
      getProductReviews({
        data: {
          productId,
          page,
          pageSize: 10,
          sort,
          ...(rating ? { rating } : {}),
        },
      }),
    placeholderData: (previousData) => previousData,
  })

  const refreshReviews = async () => {
    await queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] })
  }

  const handleReport = async (reason: ReviewReportReason, details: string | null) => {
    if (!reportingId) return
    setReportBusy(true)
    setReportError(null)
    try {
      await reportReview({ data: { reviewId: reportingId, reason, details } })
      await refreshReviews()
      setReportedReviews((previous) => ({ ...previous, [reportingId]: true }))
      setReportingId(null)
    } catch {
      setReportError(m.review_report_error())
    } finally {
      setReportBusy(false)
    }
  }

  const handleHelpful = async (reviewId: string, viewerHasMarkedHelpful: boolean) => {
    if (helpfulBusyId) return
    setHelpfulBusyId(reviewId)
    setHelpfulErrors((previous) => ({ ...previous, [reviewId]: null }))
    try {
      await setReviewHelpful({
        data: { reviewId, helpful: !viewerHasMarkedHelpful },
      })
      await refreshReviews()
    } catch {
      setHelpfulErrors((previous) => ({
        ...previous,
        [reviewId]: m.review_helpful_error(),
      }))
    } finally {
      setHelpfulBusyId(null)
    }
  }

  if (isLoading && !data) {
    return (
      <section className='island-shell rounded-2xl p-6 sm:p-8' aria-busy='true'>
        <span className='sr-only'>{m.reviews_loading()}</span>
        <div className='animate-pulse space-y-4' aria-hidden='true'>
          <div className='size-6 rounded bg-border-subtle' />
          <div className='h-20 w-full rounded bg-border-subtle' />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <p className='text-sm text-error' role='alert'>
          {m.reviews_load_error()}
        </p>
      </section>
    )
  }

  if (!data || (data.total === 0 && rating === undefined)) {
    return (
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h2 className='mb-4 text-lg font-semibold text-text-primary'>{m.reviews_title()}</h2>
        <div className='flex flex-col items-center justify-center py-10 text-center'>
          <MessageSquare size={40} className='mb-3 text-text-muted' aria-hidden='true' />
          <p className='text-base font-medium text-text-secondary'>{m.reviews_empty_title()}</p>
          <p className='mt-1 text-sm text-text-muted'>{m.reviews_empty_description()}</p>
        </div>
        <ReviewDisclosure />
      </section>
    )
  }

  const hasPrev = data.page > 1
  const hasNext = data.page < data.totalPages

  return (
    <section className='island-shell rounded-2xl p-6 sm:p-8'>
      <h2 className='mb-6 text-lg font-semibold text-text-primary'>{m.reviews_title()}</h2>

      {data.total > 0 && (
        <div className='mb-8 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start'>
          <div className='flex flex-col items-center justify-center rounded-xl bg-bg-inset px-6 py-5'>
            <span className='text-4xl font-bold text-text-primary'>
              {data.averageRating?.toFixed(1) ?? '0.0'}
            </span>
            <div className='mt-1'>
              <StarRating rating={Math.round(data.averageRating ?? 0)} />
            </div>
            <span className='mt-1.5 text-sm text-text-muted'>
              {m.reviews_count({ count: data.total })}
            </span>
          </div>

          <div className='space-y-1.5 self-center'>
            {data.distribution.map((distribution) => (
              <DistributionBar
                key={distribution.rating}
                rating={distribution.rating}
                count={distribution.count}
                total={data.total}
              />
            ))}
          </div>
        </div>
      )}

      <ReviewDisclosure />

      <fieldset className='mt-6 grid gap-4 border-x-0 border-y border-border-subtle px-0 py-4 sm:grid-cols-2'>
        <legend className='sr-only'>{m.reviews_controls_label()}</legend>
        <div>
          <Label htmlFor={sortId}>{m.reviews_sort_label()}</Label>
          <Select
            id={sortId}
            className='mt-1'
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ReviewSort)
              setPage(1)
            }}
          >
            <option value='newest'>{m.reviews_sort_newest()}</option>
            <option value='highest'>{m.reviews_sort_highest()}</option>
            <option value='lowest'>{m.reviews_sort_lowest()}</option>
            <option value='helpful'>{m.reviews_sort_helpful()}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={ratingId}>{m.reviews_rating_filter_label()}</Label>
          <Select
            id={ratingId}
            className='mt-1'
            value={rating ?? 'all'}
            onChange={(event) => {
              const value = event.target.value
              setRating(
                value === 'all' ? undefined : (Number(value) as Exclude<RatingFilter, undefined>),
              )
              setPage(1)
            }}
          >
            <option value='all'>{m.reviews_rating_all()}</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {m.reviews_rating_option({ rating: value })}
              </option>
            ))}
          </Select>
        </div>
      </fieldset>

      {isFetching && (
        <p className='sr-only' role='status'>
          {m.reviews_updating()}
        </p>
      )}

      {data.total === 0 ? (
        <div className='py-10 text-center' role='status'>
          <p className='text-base font-medium text-text-secondary'>
            {m.reviews_filter_empty_title()}
          </p>
          <p className='mt-1 text-sm text-text-muted'>{m.reviews_filter_empty_description()}</p>
        </div>
      ) : (
        <div className='mt-6 space-y-4' aria-busy={isFetching || undefined}>
          {data.reviews.map((review) => (
            <article
              key={review.id}
              className='rounded-xl border border-border-subtle bg-surface-default p-4 sm:p-5'
            >
              <div className='mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
                <div className='flex min-w-0 items-center gap-2'>
                  <div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-primary-subtle text-sm font-semibold text-accent-primary'>
                    {(review.buyerName || m.reviews_anonymous_buyer()).charAt(0).toUpperCase()}
                  </div>
                  <h3 className='truncate text-sm font-medium text-text-primary'>
                    {review.buyerName || m.reviews_anonymous_buyer()}
                  </h3>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  <div className='text-left sm:text-right'>
                    <time
                      className='block text-xs text-text-muted'
                      dateTime={new Date(review.createdAt).toISOString()}
                    >
                      {formatReviewDate(review.createdAt)}
                    </time>
                    {review.experiencedAt && (
                      <time
                        className='block text-xs text-text-muted'
                        dateTime={new Date(review.experiencedAt).toISOString()}
                      >
                        {m.reviews_experienced_at({
                          date: formatReviewDate(review.experiencedAt),
                        })}
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
                      className='rounded p-1 text-text-muted transition hover:bg-bg-inset hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
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
                        className={reportedReviews[review.id] ? 'fill-error text-error' : undefined}
                        aria-hidden='true'
                      />
                    </button>
                  )}
                </div>
              </div>

              <div className='mb-2 ml-8'>
                <StarRating rating={review.rating} />
              </div>
              {review.comment && (
                <p className='ml-8 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary'>
                  {review.comment}
                </p>
              )}

              <div className='ml-8 mt-3'>
                {review.canMarkHelpful ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className={
                      review.viewerHasMarkedHelpful
                        ? 'bg-accent-primary-subtle text-accent-primary'
                        : undefined
                    }
                    aria-pressed={review.viewerHasMarkedHelpful}
                    aria-label={
                      review.viewerHasMarkedHelpful
                        ? m.review_helpful_remove_label({ count: review.helpfulCount })
                        : m.review_helpful_mark_label({ count: review.helpfulCount })
                    }
                    isLoading={helpfulBusyId === review.id}
                    onClick={() => void handleHelpful(review.id, review.viewerHasMarkedHelpful)}
                  >
                    <ThumbsUp size={15} aria-hidden='true' />
                    {m.review_helpful_button()}
                    <span className='tabular-nums'>{review.helpfulCount}</span>
                  </Button>
                ) : (
                  <span className='inline-flex min-h-11 items-center gap-2 text-xs text-text-muted'>
                    <ThumbsUp size={15} aria-hidden='true' />
                    {m.review_helpful_button()}
                    <span className='tabular-nums'>{review.helpfulCount}</span>
                  </span>
                )}
                {helpfulErrors[review.id] && (
                  <p className='mt-2 text-sm text-error' role='alert'>
                    {helpfulErrors[review.id]}
                  </p>
                )}
              </div>

              <SellerReplySection
                productId={productId}
                reviewId={review.id}
                reply={review.sellerReply}
                canReply={review.canReply}
              />
            </article>
          ))}
        </div>
      )}

      <ReportReviewDialog
        open={reportingId !== null}
        onOpenChange={(open) => {
          if (!open) setReportingId(null)
        }}
        busy={reportBusy}
        error={reportError}
        onSubmit={(reason, details) => void handleReport(reason, details)}
      />

      {data.totalPages > 1 && (
        <nav
          className='mt-6 flex items-center justify-between border-t border-border-subtle pt-4'
          aria-label={m.pagination_label()}
        >
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setPage((currentPage) => currentPage - 1)}
            disabled={!hasPrev || isFetching}
          >
            <ChevronLeft size={16} aria-hidden='true' />
            {m.pagination_previous()}
          </Button>
          <span className='text-sm text-text-muted'>
            {m.pagination_page_of({
              page: String(data.page),
              totalPages: String(data.totalPages),
            })}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setPage((currentPage) => currentPage + 1)}
            disabled={!hasNext || isFetching}
          >
            {m.pagination_next()}
            <ChevronRight size={16} aria-hidden='true' />
          </Button>
        </nav>
      )}
    </section>
  )
}
