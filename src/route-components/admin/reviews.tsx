import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { Check, EyeOff, Flag, Inbox, Package, Store, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { StarRating } from '#/components/ui/StarRating'
import { cn } from '#/lib/cn'
import { formatDateMedium } from '#/lib/format-date'
import { resolveListingReport } from '#/lib/listing-reports/contract'
import type {
  AdminListingReport,
  AdminListingReportsResult,
  ListingReportStatus,
  ListingReportTargetType,
} from '#/lib/listing-reports/types'
import { updateReviewModerationStatus, updateSellerReplyModerationStatus } from '#/lib/reviews'
import type { AdminReviewsResult, AdminSellerRepliesResult } from '#/lib/reviews.server'
import { m } from '#/paraglide/messages'
import { ModerationDecisionDialog, type ModerationStatus } from './reviews/ModerationDecisionDialog'
import { ReportResolutionDialog } from './reviews/ReportResolutionDialog'

type ModerationContent = 'reviews' | 'seller_replies' | 'listing_reports'
type ModerationFilter = 'all' | ModerationStatus
const MODERATION_CONTENTS = ['reviews', 'seller_replies', 'listing_reports'] as const

/** The review queues' status vocabulary. */
const MODERATION_FILTERS: readonly ModerationFilter[] = ['all', 'approved', 'flagged', 'hidden']
/** The report queue's own vocabulary behind the same search key. */
const REPORT_FILTERS = ['all', 'open', 'reviewed', 'actioned', 'dismissed'] as const

type AdminModerationLoaderData =
  | { content: 'reviews'; queue: AdminReviewsResult }
  | { content: 'seller_replies'; queue: AdminSellerRepliesResult }
  | { content: 'listing_reports'; queue: AdminListingReportsResult }

type ReviewDecision = {
  content: 'reviews' | 'seller_replies'
  id: string
  status: ModerationStatus
}

type ReportDecision = {
  content: 'listing_reports'
  id: string
  targetType: ListingReportTargetType
  outcome: 'actioned' | 'dismissed'
}

type PendingDecision = ReviewDecision | ReportDecision

function StatusBadge({ status }: { status: ModerationStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        status === 'approved'
          ? 'border-success/20 bg-success-subtle text-success'
          : status === 'flagged'
            ? 'border-warning/20 bg-warning-subtle text-warning'
            : 'border-border-default bg-surface-inset text-text-muted',
      )}
    >
      {status === 'approved'
        ? m.admin_reviews_status_approved()
        : status === 'flagged'
          ? m.admin_reviews_status_flagged()
          : m.admin_reviews_status_hidden()}
    </span>
  )
}

function ReportCount({ count }: { count: number }) {
  return count > 0 ? (
    <span className='inline-flex items-center rounded-full border border-warning/20 bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning'>
      {count}
    </span>
  ) : (
    <span className='text-text-muted'>0</span>
  )
}

function ReportStatusBadge({ status }: { status: ListingReportStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        status === 'open'
          ? 'border-warning/20 bg-warning-subtle text-warning'
          : status === 'reviewed'
            ? 'border-accent-primary/20 bg-accent-primary-subtle text-accent-primary'
            : status === 'actioned'
              ? 'border-success/20 bg-success-subtle text-success'
              : 'border-border-default bg-surface-inset text-text-muted',
      )}
    >
      {status === 'open'
        ? m.listing_report_admin_status_open()
        : status === 'reviewed'
          ? m.listing_report_admin_status_reviewed()
          : status === 'actioned'
            ? m.listing_report_admin_status_actioned()
            : m.listing_report_admin_status_dismissed()}
    </span>
  )
}

function ReportReason({ reason }: { reason: AdminListingReport['reason'] }) {
  return (
    <span className='text-text-secondary'>
      {reason === 'counterfeit'
        ? m.listing_report_reason_counterfeit()
        : reason === 'unsafe'
          ? m.listing_report_reason_unsafe()
          : reason === 'illegal_goods'
            ? m.listing_report_reason_illegal_goods()
            : reason === 'fraud'
              ? m.listing_report_reason_fraud()
              : m.listing_report_reason_other()}
    </span>
  )
}

function ReportActions({
  id,
  targetType,
  status,
  onSelect,
}: {
  id: string
  targetType: ListingReportTargetType
  status: ListingReportStatus
  onSelect: (decision: PendingDecision) => void
}) {
  if (status === 'actioned' || status === 'dismissed') {
    // A recorded decision is final; there is nothing left to do here.
    return <span className='text-text-muted'>-</span>
  }

  return (
    <div className='flex items-center justify-end gap-2'>
      <Button
        variant='danger'
        size='sm'
        onClick={() =>
          onSelect({ content: 'listing_reports', id, targetType, outcome: 'actioned' })
        }
      >
        <Check size={14} aria-hidden='true' />
        {m.listing_report_admin_action_actioned()}
      </Button>
      <Button
        variant='secondary'
        size='sm'
        onClick={() =>
          onSelect({ content: 'listing_reports', id, targetType, outcome: 'dismissed' })
        }
      >
        <X size={14} aria-hidden='true' />
        {m.listing_report_admin_action_dismissed()}
      </Button>
    </div>
  )
}

function ReportsTable({
  data,
  onSelect,
}: {
  data: AdminListingReportsResult
  onSelect: (decision: PendingDecision) => void
}) {
  return (
    <TableRegion label={m.listing_report_admin_tab()}>
      <table className='w-full min-w-max text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.listing_report_admin_target()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.listing_report_admin_reporter()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.listing_report_reason_label()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.listing_report_admin_details()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reviews_created_at()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reviews_moderation_status()}
            </th>
            <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
              {m.admin_reviews_actions()}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {data.reports.map((report) => (
            <tr key={report.id} className='group transition-colors hover:bg-bg-inset/40'>
              <td className='max-w-52 py-3 pr-4'>
                <span className='flex items-center gap-2 font-medium text-text-primary'>
                  {report.targetType === 'product' ? (
                    <Package size={14} aria-hidden='true' />
                  ) : (
                    <Store size={14} aria-hidden='true' />
                  )}
                  <span className='truncate'>{report.targetName}</span>
                </span>
                <span className='mt-0.5 block text-xs text-text-muted'>
                  {report.targetType === 'product'
                    ? `${m.listing_report_admin_type_product()} · ${report.shopName}`
                    : m.listing_report_admin_type_shop()}
                </span>
              </td>
              <td className='py-3 pr-4 text-text-primary'>{report.reporterName}</td>
              <td className='py-3 pr-4'>
                <ReportReason reason={report.reason} />
              </td>
              <td className='max-w-xs whitespace-pre-wrap py-3 pr-4 text-text-secondary'>
                {report.details || <span className='italic text-text-muted'>-</span>}
              </td>
              <td className='py-3 pr-4 font-mono text-xs text-text-secondary'>
                {formatDateMedium(new Date(report.createdAt))}
              </td>
              <td className='py-3 pr-4'>
                <ReportStatusBadge status={report.status} />
              </td>
              <td className='whitespace-nowrap py-3 text-right'>
                <ReportActions
                  id={report.id}
                  targetType={report.targetType}
                  status={report.status}
                  onSelect={onSelect}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  )
}

function ModerationActions({
  content,
  id,
  status,
  onSelect,
}: {
  content: 'reviews' | 'seller_replies'
  id: string
  status: ModerationStatus
  onSelect: (decision: PendingDecision) => void
}) {
  return (
    <div className='flex items-center justify-end gap-2'>
      {status !== 'approved' && (
        <Button
          variant='secondary'
          size='sm'
          onClick={() => onSelect({ content, id, status: 'approved' })}
        >
          <Check size={14} aria-hidden='true' />
          {m.admin_reviews_action_approve()}
        </Button>
      )}
      {status !== 'hidden' && (
        <Button
          variant='danger'
          size='sm'
          onClick={() => onSelect({ content, id, status: 'hidden' })}
        >
          <EyeOff size={14} aria-hidden='true' />
          {m.admin_reviews_action_hide()}
        </Button>
      )}
      {status !== 'flagged' && (
        <Button
          variant='secondary'
          size='sm'
          onClick={() => onSelect({ content, id, status: 'flagged' })}
        >
          <Flag size={14} aria-hidden='true' />
          {m.admin_reviews_action_flag()}
        </Button>
      )}
    </div>
  )
}

function TableRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className='overflow-x-auto rounded-lg' aria-label={label}>
      {children}
    </section>
  )
}

function ReviewsTable({
  data,
  onSelect,
}: {
  data: AdminReviewsResult
  onSelect: (decision: PendingDecision) => void
}) {
  return (
    <TableRegion label={m.admin_reviews_content_reviews()}>
      <table className='w-full min-w-max text-left text-sm'>
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
          {data.reviews.map((review) => (
            <tr key={review.id} className='group transition-colors hover:bg-bg-inset/40'>
              <td className='max-w-44 truncate py-3 pr-4 font-medium text-text-primary'>
                {review.productName}
              </td>
              <td className='py-3 pr-4 text-text-primary'>{review.buyerName}</td>
              <td className='py-3 pr-4'>
                <StarRating rating={review.rating} />
              </td>
              <td className='max-w-xs whitespace-pre-wrap py-3 pr-4 text-text-secondary'>
                {review.comment || <span className='italic text-text-muted'>-</span>}
              </td>
              <td className='py-3 pr-4 font-mono text-xs text-text-secondary'>
                {formatDateMedium(new Date(review.createdAt))}
              </td>
              <td className='py-3 pr-4'>
                <StatusBadge status={review.moderationStatus} />
              </td>
              <td className='py-3 pr-4 tabular-nums text-text-secondary'>
                <ReportCount count={review.openReports} />
              </td>
              <td className='whitespace-nowrap py-3 text-right'>
                <ModerationActions
                  content='reviews'
                  id={review.id}
                  status={review.moderationStatus}
                  onSelect={onSelect}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  )
}

function SellerRepliesTable({
  data,
  onSelect,
}: {
  data: AdminSellerRepliesResult
  onSelect: (decision: PendingDecision) => void
}) {
  return (
    <TableRegion label={m.admin_reviews_content_seller_replies()}>
      <table className='w-full min-w-max text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reviews_product()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_seller_replies_seller()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_seller_replies_reply()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_seller_replies_review()}
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
          {data.sellerReplies.map((reply) => (
            <tr key={reply.id} className='group transition-colors hover:bg-bg-inset/40'>
              <td className='max-w-44 truncate py-3 pr-4 font-medium text-text-primary'>
                {reply.productName}
              </td>
              <td className='py-3 pr-4'>
                <span className='block font-medium text-text-primary'>{reply.sellerName}</span>
                <span className='block text-xs text-text-muted'>
                  {m.admin_seller_replies_shop()}: {reply.shopName}
                </span>
              </td>
              <td className='max-w-sm whitespace-pre-wrap py-3 pr-4 text-text-primary'>
                {reply.body}
              </td>
              <td className='max-w-xs py-3 pr-4'>
                <span className='block text-xs font-medium text-text-muted'>
                  {m.admin_seller_replies_review_by({ buyerName: reply.buyerName })}
                </span>
                <span className='mt-1 block'>
                  <StarRating rating={reply.reviewRating} />
                </span>
                {reply.reviewComment && (
                  <span className='mt-1 block whitespace-pre-wrap text-text-secondary'>
                    {reply.reviewComment}
                  </span>
                )}
              </td>
              <td className='py-3 pr-4 font-mono text-xs text-text-secondary'>
                {formatDateMedium(new Date(reply.createdAt))}
              </td>
              <td className='py-3 pr-4'>
                <StatusBadge status={reply.moderationStatus} />
              </td>
              <td className='py-3 pr-4 tabular-nums text-text-secondary'>
                <ReportCount count={reply.openReports} />
              </td>
              <td className='whitespace-nowrap py-3 text-right'>
                <ModerationActions
                  content='seller_replies'
                  id={reply.id}
                  status={reply.moderationStatus}
                  onSelect={onSelect}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  )
}

export function AdminReviewsPage() {
  const loaderData = useLoaderData({ from: '/admin/reviews' }) as AdminModerationLoaderData
  const search = useSearch({ from: '/admin/reviews' })
  const queueKey =
    loaderData.content === 'reviews'
      ? loaderData.queue.reviews
          .map((review) => `${review.id}:${review.moderationStatus}`)
          .join(',')
      : loaderData.content === 'seller_replies'
        ? loaderData.queue.sellerReplies
            .map((reply) => `${reply.id}:${reply.moderationStatus}`)
            .join(',')
        : loaderData.queue.reports.map((report) => `${report.id}:${report.status}`).join(',')

  return (
    <AdminReviewsContent
      key={`${search.content}:${search.status}:${search.page}:${queueKey}`}
      initialData={loaderData}
    />
  )
}

function AdminReviewsContent({ initialData }: { initialData: AdminModerationLoaderData }) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/reviews' })
  const [queueData, setQueueData] = useState(initialData)
  const [pending, setPending] = useState<PendingDecision | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Switching queues resets the filter: the vocabularies are disjoint. */
  const handleContentChange = useCallback(
    (content: ModerationContent) => {
      navigate({
        to: '/admin/reviews',
        search: { ...search, content, status: 'all', page: 1 },
        replace: true,
      })
    },
    [navigate, search],
  )

  /** Status vocabularies do not overlap between queues, so switching queues
      always lands on "All" rather than a filter the new queue cannot express. */
  const handleStatusChange = useCallback(
    (status: string) => {
      navigate({
        to: '/admin/reviews',
        search: { ...search, status: status as ModerationFilter, page: 1 },
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

  const selectDecision = useCallback((decision: PendingDecision) => {
    setError(null)
    setPending(decision)
  }, [])

  const handleConfirmDecision = async (
    ground: 'illegal' | 'terms',
    explanation: string,
    legalBasis?: string,
  ) => {
    if (!pending || pending.content === 'listing_reports') return
    setBusy(true)
    setError(null)

    try {
      if (pending.content === 'reviews') {
        await updateReviewModerationStatus({
          data: { reviewId: pending.id, status: pending.status, ground, explanation },
        })
        setQueueData((previous) =>
          previous.content === 'reviews'
            ? {
                ...previous,
                queue: {
                  ...previous.queue,
                  reviews: previous.queue.reviews.map((review) =>
                    review.id === pending.id
                      ? { ...review, moderationStatus: pending.status, openReports: 0 }
                      : review,
                  ),
                },
              }
            : previous,
        )
      } else {
        const normalizedLegalBasis = legalBasis?.trim()
        if (!normalizedLegalBasis) {
          setError(m.admin_seller_replies_decision_error())
          return
        }
        await updateSellerReplyModerationStatus({
          data: {
            replyId: pending.id,
            status: pending.status,
            ground,
            legalBasis: normalizedLegalBasis,
            explanation,
          },
        })
        setQueueData((previous) =>
          previous.content === 'seller_replies'
            ? {
                ...previous,
                queue: {
                  ...previous.queue,
                  sellerReplies: previous.queue.sellerReplies.map((reply) =>
                    reply.id === pending.id
                      ? { ...reply, moderationStatus: pending.status, openReports: 0 }
                      : reply,
                  ),
                },
              }
            : previous,
        )
      }
      setPending(null)
    } catch {
      setError(
        pending.content === 'seller_replies'
          ? m.admin_seller_replies_decision_error()
          : m.admin_reviews_decision_error(),
      )
    } finally {
      setBusy(false)
    }
  }

  /** Records the decision on a notice and updates the open queue in place;
      the resolution note is kept word for word on the report's record. */
  const handleConfirmResolution = async (outcome: 'actioned' | 'dismissed', note: string) => {
    if (!pending || pending.content !== 'listing_reports') return
    setBusy(true)
    setError(null)

    try {
      await resolveListingReport({
        data: {
          reportId: pending.id,
          targetType: pending.targetType,
          outcome,
          note,
        },
      })
      setQueueData((previous) =>
        previous.content === 'listing_reports'
          ? {
              ...previous,
              queue: {
                ...previous.queue,
                reports: previous.queue.reports.map((report) =>
                  report.id === pending.id
                    ? { ...report, status: outcome, resolutionNote: note, resolvedAt: new Date() }
                    : report,
                ),
              },
            }
          : previous,
      )
      setPending(null)
    } catch {
      setError(m.listing_report_admin_resolve_error())
    } finally {
      setBusy(false)
    }
  }

  const selectedContent = search.content ?? 'reviews'
  const selectedStatus = search.status ?? 'all'
  const totalPages = queueData.queue.totalPages
  const isEmpty =
    queueData.content === 'reviews'
      ? queueData.queue.reviews.length === 0
      : queueData.content === 'seller_replies'
        ? queueData.queue.sellerReplies.length === 0
        : queueData.queue.reports.length === 0

  /** Both vocabularies share this row; the switch keeps each label exact. */
  const statusFilterLabel = (status: string): string => {
    switch (status) {
      case 'approved':
        return m.admin_reviews_status_approved()
      case 'flagged':
        return m.admin_reviews_status_flagged()
      case 'hidden':
        return m.admin_reviews_status_hidden()
      case 'open':
        return m.listing_report_admin_status_open()
      case 'reviewed':
        return m.listing_report_admin_status_reviewed()
      case 'actioned':
        return m.listing_report_admin_status_actioned()
      case 'dismissed':
        return m.listing_report_admin_status_dismissed()
      default:
        return m.admin_reviews_status_all()
    }
  }

  return (
    <div className='space-y-6'>
      <header>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_reviews_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_reviews_description()}</p>
      </header>

      <fieldset className='flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-border-default bg-surface-inset p-1'>
        <legend className='sr-only'>{m.admin_reviews_content_label()}</legend>
        {MODERATION_CONTENTS.map((content) => {
          const selected = selectedContent === content
          return (
            <button
              key={content}
              type='button'
              aria-pressed={selected}
              onClick={() => handleContentChange(content)}
              className={cn(
                'h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
                selected
                  ? 'bg-surface-default text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {content === 'reviews'
                ? m.admin_reviews_content_reviews()
                : content === 'seller_replies'
                  ? m.admin_reviews_content_seller_replies()
                  : m.listing_report_admin_tab()}
            </button>
          )
        })}
      </fieldset>

      <fieldset className='flex max-w-full overflow-x-auto border-x-0 border-t-0 border-b border-border-default p-0'>
        <legend className='sr-only'>{m.admin_reviews_moderation_status()}</legend>
        {(selectedContent === 'listing_reports' ? REPORT_FILTERS : MODERATION_FILTERS).map(
          (status) => {
            const selected = selectedStatus === status
            return (
              <button
                key={status}
                type='button'
                aria-pressed={selected}
                aria-controls='moderation-queue'
                onClick={() => handleStatusChange(status)}
                className={cn(
                  'h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-inset',
                  selected
                    ? 'border-accent-primary font-semibold text-accent-primary'
                    : 'border-transparent text-text-secondary hover:border-border-default hover:text-text-primary',
                )}
              >
                {statusFilterLabel(status)}
              </button>
            )
          },
        )}
      </fieldset>

      <section
        id='moderation-queue'
        aria-label={
          selectedContent === 'reviews'
            ? m.admin_reviews_content_reviews()
            : selectedContent === 'seller_replies'
              ? m.admin_reviews_content_seller_replies()
              : m.listing_report_admin_tab()
        }
        aria-live='polite'
      >
        {isEmpty ? (
          <Card variant='elevated'>
            <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
              <Inbox size={40} className='mb-3 text-text-muted' aria-hidden='true' />
              <p className='text-sm text-text-secondary'>
                {queueData.content === 'reviews'
                  ? m.admin_reviews_no_reviews()
                  : queueData.content === 'seller_replies'
                    ? m.admin_seller_replies_no_replies()
                    : m.listing_report_admin_empty()}
              </p>
            </CardContent>
          </Card>
        ) : queueData.content === 'reviews' ? (
          <ReviewsTable data={queueData.queue} onSelect={selectDecision} />
        ) : queueData.content === 'seller_replies' ? (
          <SellerRepliesTable data={queueData.queue} onSelect={selectDecision} />
        ) : (
          <ReportsTable data={queueData.queue} onSelect={selectDecision} />
        )}
      </section>

      {pending && pending.content === 'listing_reports' ? (
        <ReportResolutionDialog
          key={`${pending.id}:${pending.outcome}`}
          open
          outcome={pending.outcome}
          busy={busy}
          error={error}
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null)
          }}
          onConfirm={handleConfirmResolution}
        />
      ) : (
        <ModerationDecisionDialog
          key={
            pending
              ? `${pending.content}:${pending.id}:${pending.status}`
              : 'closed-decision-dialog'
          }
          open={pending !== null}
          status={pending?.status ?? null}
          contentType={pending?.content === 'seller_replies' ? 'seller_reply' : 'review'}
          busy={busy}
          error={error}
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null)
          }}
          onConfirm={handleConfirmDecision}
        />
      )}
      {totalPages > 1 && (
        <nav
          className='mt-6 flex items-center justify-between gap-4 border-t border-border-subtle pt-4'
          aria-label={m.pagination_label()}
        >
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handlePageChange((search.page ?? 1) - 1)}
            disabled={(search.page ?? 1) <= 1}
          >
            &larr; {m.pagination_previous()}
          </Button>
          <span className='text-center text-sm tabular-nums text-text-muted'>
            {m.pagination_page_of({
              page: String(search.page ?? 1),
              totalPages: String(totalPages),
            })}
          </span>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handlePageChange((search.page ?? 1) + 1)}
            disabled={(search.page ?? 1) >= totalPages}
          >
            {m.pagination_next()} &rarr;
          </Button>
        </nav>
      )}
    </div>
  )
}
