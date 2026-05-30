import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listAllPlatformOrders } from '#/lib/admin-orders'
import { AdminOrdersPage } from '#/route-components/admin/orders'
import { AdminOrdersPending } from '#/route-components/admin/orders/AdminOrdersPending'
import { AdminOrdersError } from '#/route-components/admin/orders/AdminOrdersError'

const ordersSearchSchema = z.object({
  query: z.string().optional().default(''),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  statuses: z.array(z.string()).optional().default([]),
  sortBy: z.enum(['createdAt', 'totalCents']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/orders')({
  validateSearch: ordersSearchSchema,
  loaderDeps: ({ search: { query, from, to, statuses, sortBy, sortDir, page, pageSize } }) => ({
    query,
    from,
    to,
    statuses,
    sortBy,
    sortDir,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return listAllPlatformOrders({
      data: {
        query: deps.query || undefined,
        from: deps.from || undefined,
        to: deps.to || undefined,
        statuses: deps.statuses.length > 0 ? deps.statuses : undefined,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({
    meta: [{ title: 'Order Inspector | Admin | Eurtisan' }],
  }),
  component: AdminOrdersPage,
  pendingComponent: AdminOrdersPending,
  errorComponent: AdminOrdersError,
})
