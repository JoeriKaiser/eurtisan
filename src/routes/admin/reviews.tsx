import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { getAdminReviews } from '#/lib/reviews'
import { AdminReviewsPage } from '#/route-components/admin/reviews'

const reviewsSearchSchema = z.object({
  status: z.enum(['all', 'approved', 'flagged', 'hidden']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/reviews')({
  validateSearch: reviewsSearchSchema,
  loaderDeps: ({ search: { status, page, pageSize } }) => ({
    status,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return getAdminReviews({
      data: {
        status: deps.status,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({ meta: [{ title: 'Reviews | Admin | Eurtisan' }] }),
  component: AdminReviewsPage,
})
