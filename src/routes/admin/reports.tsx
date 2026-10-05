import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { getAdminProductReports } from '#/lib/products'
import { getAdminShopReports } from '#/lib/shop-profile'
import { AdminReportsError } from '#/route-components/admin/reports.error'
import { AdminReportsPending } from '#/route-components/admin/reports.pending'
import { AdminReportsPage } from '#/route-components/admin/reports'

export const reportsSearchSchema = z.object({
  content: z.enum(['product', 'shop']).optional().default('product'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const Route = createFileRoute('/admin/reports')({
  validateSearch: reportsSearchSchema,
  loaderDeps: ({ search: { content, page, pageSize } }) => ({
    content,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    if (deps.content === 'shop') {
      const reports = await getAdminShopReports({
        data: {
          page: deps.page,
          pageSize: deps.pageSize,
        },
      })
      return { content: 'shop' as const, queue: reports }
    }

    const reports = await getAdminProductReports({
      data: {
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
    return { content: 'product' as const, queue: reports }
  },
  head: () => ({ meta: [{ title: 'Reports | Admin | Eurtisan' }] }),
  component: AdminReportsPage,
  pendingComponent: AdminReportsPending,
  errorComponent: AdminReportsError,
})
