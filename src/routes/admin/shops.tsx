import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { getShopsForModeration } from '#/lib/sell-onboarding'
import type { PaginatedShops, SuspensionFilter } from '#/lib/shop-moderation'
import { listAllShops } from '#/lib/shop-moderation'
import { AdminShopsPage, AdminShopsPending, AdminShopsError } from '#/route-components/admin/shops'

const shopsSearchSchema = z.object({
  view: z.enum(['moderation', 'applications']).optional().default('moderation'),
  filter: z.enum(['all', 'active', 'suspended']).optional().default('all'),
  status: z
    .enum(['all', 'pending_review', 'changes_requested', 'approved', 'rejected'])
    .optional()
    .default('all'),
  query: z.string().optional().default(''),
  sortBy: z.enum(['name', 'createdAt', 'status']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

type LoaderResult =
  | { view: 'moderation'; shops: PaginatedShops }
  | { view: 'applications'; applications: Awaited<ReturnType<typeof getShopsForModeration>> }

export const Route = createFileRoute('/admin/shops')({
  validateSearch: shopsSearchSchema,
  loaderDeps: ({ search: { view, filter, status, query, sortBy, sortDir, page, pageSize } }) => ({
    view,
    filter,
    status,
    query,
    sortBy,
    sortDir,
    page,
    pageSize,
  }),
  loader: async ({ deps }): Promise<LoaderResult> => {
    if (deps.view === 'applications') {
      const applications = await getShopsForModeration({
        data: { status: deps.status },
      })
      return { view: 'applications', applications }
    }
    const shops = await listAllShops({
      data: {
        filter: deps.filter as SuspensionFilter,
        query: deps.query || undefined,
        sortBy: deps.sortBy,
        sortDir: deps.sortDir,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
    return { view: 'moderation', shops }
  },
  head: () => ({
    meta: [{ title: 'Shops | Admin | Eurtisan' }],
  }),
  component: AdminShopsPage,
  pendingComponent: AdminShopsPending,
  errorComponent: AdminShopsError,
})
