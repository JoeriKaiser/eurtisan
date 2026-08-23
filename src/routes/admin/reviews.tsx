import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { getAdminListingReports } from '#/lib/listing-reports/contract'
import { getAdminReviews, getAdminSellerReplies } from '#/lib/reviews'
import { AdminReviewsError } from '#/route-components/admin/reviews.error'
import { AdminReviewsPending } from '#/route-components/admin/reviews.pending'
import { AdminReviewsPage } from '#/route-components/admin/reviews'

export const reviewsSearchSchema = z.object({
  content: z.enum(['reviews', 'seller_replies', 'listing_reports']).optional().default('reviews'),
  // One search key serves queues with different status vocabularies; a value
  // from the other queue maps onto "All" instead of erroring or rendering a
  // silently wrong filter.
  status: z
    .enum(['all', 'approved', 'flagged', 'hidden', 'open', 'reviewed', 'actioned', 'dismissed'])
    .optional()
    .default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

type SearchStatus = z.infer<typeof reviewsSearchSchema>['status']

const REPORT_FILTERS = ['open', 'reviewed', 'actioned', 'dismissed'] as const

/**
 * Type guard preserving the queue split: every branch below narrows through
 * it, so a listing-reports URL can never hand `actioned` to review moderation
 * or `flagged` to the report queue.
 */
function isReportFilter(status: SearchStatus): status is 'all' | (typeof REPORT_FILTERS)[number] {
  return status === 'all' || (REPORT_FILTERS as readonly string[]).includes(status)
}

export const Route = createFileRoute('/admin/reviews')({
  validateSearch: reviewsSearchSchema,
  loaderDeps: ({ search: { content, status, page, pageSize } }) => ({
    content,
    status,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    const reportStatus = isReportFilter(deps.status) ? deps.status : 'all'
    const reviewStatus = isReportFilter(deps.status) ? ('all' as const) : deps.status

    if (deps.content === 'listing_reports') {
      const queue = await getAdminListingReports({
        data: {
          status: reportStatus,
          page: deps.page,
          pageSize: deps.pageSize,
        },
      })
      return { content: 'listing_reports' as const, queue }
    }

    if (deps.content === 'seller_replies') {
      const sellerReplies = await getAdminSellerReplies({
        data: {
          status: reviewStatus,
          page: deps.page,
          pageSize: deps.pageSize,
        },
      })
      return { content: 'seller_replies' as const, queue: sellerReplies }
    }

    const reviews = await getAdminReviews({
      data: {
        status: reviewStatus,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
    return { content: 'reviews' as const, queue: reviews }
  },
  head: () => ({ meta: [{ title: 'Reviews | Admin | Eurtisan' }] }),
  component: AdminReviewsPage,
  pendingComponent: AdminReviewsPending,
  errorComponent: AdminReviewsError,
})
