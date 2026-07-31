import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { Check, EyeOff, Flag, Inbox, Star } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Card, CardContent } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import type { AdminReviewsResult } from '#/lib/reviews.server'
import { updateReviewModerationStatus } from '#/lib/reviews'
import { ModerationDecisionDialog, type ModerationStatus } from './reviews/ModerationDecisionDialog'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/cn'
import { formatDateMedium } from '#/lib/format-date'

function formatDate(date: Date | string): string {
  return formatDateMedium(new Date(date))
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className='flex items-center gap-0.5'>
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
    </div>
  )
}

export function AdminReviewsPage() {
  const loaderData = useLoaderData({ from: '/admin/reviews' }) as AdminReviewsResult
  const search = useSearch({ from: '/admin/reviews' })
  return (
    <AdminReviewsContent
      key={`${search.status}:${search.page}:${loaderData.reviews.map((review) => `${review.id}:${review.moderationStatus}`).join(',')}`}
    />
  )
}

function AdminReviewsContent() {
  const loaderData = useLoaderData({ from: '/admin/reviews' }) as AdminReviewsResult
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/reviews' })
  const [reviewsData, setReviewsData] = useState(loaderData)

  const handleStatusChange = useCallback(
    (status: 'all' | 'approved' | 'flagged' | 'hidden') => {
      navigate({
        to: '/admin/reviews',
        search: { ...search, status, page: 1 },
        replace: true,
      })
    },
    [navigate, search],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      navigate({
        to: '/admin/reviews',
        search: { ...search, page },
        replace: true,
      })
    },
    [navigate, search],
  )

  // The decision is staged rather than applied on click: it cannot be sent
  // until a ground and an explanation exist, because the DSA Article 17
  // statement of reasons is built from them.
  const [pending, setPending] = useState<{ reviewId: string; status: ModerationStatus } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirmDecision = async (ground: 'illegal' | 'terms', explanation: string) => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await updateReviewModerationStatus({
        data: { reviewId: pending.reviewId, status: pending.status, ground, explanation },
      })
      setReviewsData((prev) => ({
        ...prev,
        reviews: prev.reviews.map((r) =>
          r.id === pending.reviewId
            ? { ...r, moderationStatus: pending.status, openReports: 0 }
            : r,
        ),
      }))
      setPending(null)
    } catch {
      setError(m.admin_reviews_decision_error())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_reviews_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_reviews_description()}</p>
      </div>

      {/* Filter Tabs */}
      <div className='flex border-b border-border-default'>
        {(['all', 'approved', 'flagged', 'hidden'] as const).map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => handleStatusChange(s)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              (search.status ?? 'all') === s
                ? 'border-accent-primary text-accent-primary font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default',
            )}
          >
            {s === 'all'
              ? m.admin_reviews_status_all()
              : s === 'approved'
                ? m.admin_reviews_status_approved()
                : s === 'flagged'
                  ? m.admin_reviews_status_flagged()
                  : m.admin_reviews_status_hidden()}
          </button>
        ))}
      </div>

      {/* Content */}
      {reviewsData.reviews.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Inbox size={40} className='mb-3 text-text-muted' aria-hidden='true' />
            <p className='text-sm text-text-secondary'>{m.admin_reviews_no_reviews()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border-default'>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_product()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_buyer()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_rating()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_comment()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_created_at()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_moderation_status()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_reviews_open_reports()}
                </th>
                <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
                  {m.admin_reviews_actions()}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border-subtle'>
              {reviewsData.reviews.map((review) => (
                <tr key={review.id} className='group hover:bg-bg-inset/40 transition-colors'>
                  <td className='py-3 pr-4 font-medium text-text-primary max-w-[180px] truncate'>
                    {review.productName}
                  </td>
                  <td className='py-3 pr-4 text-text-primary'>{review.buyerName}</td>
                  <td className='py-3 pr-4'>
                    <StarRating rating={review.rating} />
                  </td>
                  <td className='py-3 pr-4 text-text-secondary max-w-[250px] whitespace-pre-wrap truncate'>
                    {review.comment || <span className='italic text-text-muted'>-</span>}
                  </td>
                  <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                    {formatDate(review.createdAt)}
                  </td>
                  <td className='py-3 pr-4'>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                        review.moderationStatus === 'approved'
                          ? 'bg-success-subtle text-success border-success/20'
                          : review.moderationStatus === 'flagged'
                            ? 'bg-warning-subtle text-warning border-warning/20'
                            : 'bg-surface-inset text-text-muted border-border-default',
                      )}
                    >
                      {review.moderationStatus === 'approved'
                        ? m.admin_reviews_status_approved()
                        : review.moderationStatus === 'flagged'
                          ? m.admin_reviews_status_flagged()
                          : m.admin_reviews_status_hidden()}
                    </span>
                  </td>
                  <td className='py-3 pr-4 tabular-nums text-text-secondary'>
                    {review.openReports > 0 ? (
                      <span className='inline-flex items-center rounded-full border border-warning/20 bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning'>
                        {review.openReports}
                      </span>
                    ) : (
                      <span className='text-text-muted'>0</span>
                    )}
                  </td>
                  <td className='py-3 text-right whitespace-nowrap'>
                    <div className='flex items-center justify-end gap-2'>
                      {review.moderationStatus !== 'approved' && (
                        <Button
                          variant='secondary'
                          size='sm'
                          onClick={() => {
                            setError(null)
                            setPending({ reviewId: review.id, status: 'approved' })
                          }}
                          className='inline-flex items-center gap-1'
                        >
                          <Check size={14} />
                          {m.admin_reviews_action_approve()}
                        </Button>
                      )}
                      {review.moderationStatus !== 'hidden' && (
                        <Button
                          variant='danger'
                          size='sm'
                          onClick={() => {
                            setError(null)
                            setPending({ reviewId: review.id, status: 'hidden' })
                          }}
                          className='inline-flex items-center gap-1'
                        >
                          <EyeOff size={14} />
                          {m.admin_reviews_action_hide()}
                        </Button>
                      )}
                      {review.moderationStatus !== 'flagged' && (
                        <Button
                          variant='secondary'
                          size='sm'
                          onClick={() => {
                            setError(null)
                            setPending({ reviewId: review.id, status: 'flagged' })
                          }}
                          className='inline-flex items-center gap-1'
                        >
                          <Flag size={14} />
                          {m.admin_reviews_action_flag()}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModerationDecisionDialog
        open={pending !== null}
        status={pending?.status ?? null}
        busy={busy}
        error={error}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        onConfirm={handleConfirmDecision}
      />

      {/* Pagination */}
      {reviewsData.totalPages > 1 && (
        <div className='mt-6 flex items-center justify-between border-t border-[var(--ds-border-subtle)] pt-4'>
          <button
            type='button'
            onClick={() => handlePageChange((search.page ?? 1) - 1)}
            disabled={(search.page ?? 1) <= 1}
            className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-bg-inset)] disabled:cursor-not-allowed disabled:opacity-40'
          >
            &larr; {m.pagination_previous()}
          </button>
          <span className='text-sm text-[var(--ds-text-muted)]'>
            {m.pagination_page_of({
              page: String(search.page ?? 1),
              totalPages: String(reviewsData.totalPages),
            })}
          </span>
          <button
            type='button'
            onClick={() => handlePageChange((search.page ?? 1) + 1)}
            disabled={(search.page ?? 1) >= reviewsData.totalPages}
            className='inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-bg-inset)] disabled:cursor-not-allowed disabled:opacity-40'
          >
            {m.pagination_next()} &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
