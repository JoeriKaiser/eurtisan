import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listPayoutHistory, listPendingPayouts } from '#/lib/admin-payouts'
import { AdminPayoutsPage } from '#/route-components/admin/payouts'
import { AdminPayoutsPending } from '#/route-components/admin/payouts.pending'
import { AdminPayoutsError } from '#/route-components/admin/payouts.error'

const payoutsSearchSchema = z.object({
  tab: z.enum(['pending', 'history']).optional().default('pending'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
  query: z.string().optional().default(''),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
})

export const Route = createFileRoute('/admin/payouts')({
  validateSearch: payoutsSearchSchema,
  loaderDeps: ({ search: { tab, page, pageSize, query, from, to } }) => ({
    tab,
    page,
    pageSize,
    query,
    from,
    to,
  }),
  loader: async ({ deps }) => {
    if (deps.tab === 'pending') {
      const payouts = await listPendingPayouts({
        data: { page: deps.page, pageSize: deps.pageSize },
      })
      return { tab: 'pending' as const, payouts }
    }

    const history = await listPayoutHistory({
      data: {
        page: deps.page,
        pageSize: deps.pageSize,
        query: deps.query || undefined,
        from: deps.from || undefined,
        to: deps.to || undefined,
      },
    })
    return { tab: 'history' as const, history }
  },
  head: () => ({
    meta: [{ title: 'Payouts | Admin | Eurtisan' }],
  }),
  component: AdminPayoutsPage,
  pendingComponent: AdminPayoutsPending,
  errorComponent: AdminPayoutsError,
})
