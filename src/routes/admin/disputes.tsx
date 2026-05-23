import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listOpenDisputes } from '#/lib/disputes'
import {
  AdminDisputesPage,
  AdminDisputesPending,
  AdminDisputesError,
} from '#/route-components/admin/disputes'

const PAGE_SIZE = 20

const disputesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  status: z.enum(['all', 'open', 'resolved']).optional().default('open'),
  query: z.string().optional().default(''),
})

export const Route = createFileRoute('/admin/disputes')({
  validateSearch: disputesSearchSchema,
  loaderDeps: ({ search: { page, status, query } }) => ({ page, status, query }),
  loader: async ({ deps }) => {
    const result = await listOpenDisputes({
      data: {
        page: deps.page,
        pageSize: PAGE_SIZE,
        status: deps.status,
        query: deps.query || undefined,
      },
    })
    return result
  },
  head: () => ({
    meta: [{ title: 'Disputes | Admin' }],
  }),
  component: AdminDisputesPage,
  pendingComponent: AdminDisputesPending,
  errorComponent: AdminDisputesError,
})
