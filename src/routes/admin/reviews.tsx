import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { getAdminReviews, getAdminSellerReplies } from '#/lib/reviews'
import { AdminReviewsError } from '#/route-components/admin/reviews.error'
import { AdminReviewsPending } from '#/route-components/admin/reviews.pending'
import { AdminReviewsPage } from '#/route-components/admin/reviews'

export const reviewsSearchSchema = z.object({
  content: z.enum(['reviews', 'seller_replies']).optional().default('reviews'),
  status: z.enum(['all', 'approved', 'flagged', 'hidden']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const Route = createFileRoute('/admin/reviews')({
  validateSearch: reviewsSearchSchema,
  loaderDeps: ({ search: { content, status, page, pageSize } }) => ({
    content,
    status,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    if (deps.content === 'seller_replies') {
      const sellerReplies = await getAdminSellerReplies({
        data: {
          status: deps.status,
          page: deps.page,
          pageSize: deps.pageSize,
        },
      })
      return { content: 'seller_replies' as const, queue: sellerReplies }
    }

    const reviews = await getAdminReviews({
      data: {
        status: deps.status,
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
