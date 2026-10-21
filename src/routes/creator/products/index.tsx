import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'
import { getCreatorShops } from '#/lib/creator-dashboard'

const productSearchSchema = z.object({
  shopId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  active: z.enum(['true', 'false', 'all']).optional(),
  status: z.enum(['all', 'draft', 'published', 'archived']).optional(),
  search: z.string().max(200).optional(),
})

export const Route = createFileRoute('/creator/products/')({
  validateSearch: productSearchSchema,
  beforeLoad: async ({ search }) => {
    const shopId = search.shopId ?? (await getCreatorShops())[0]?.id
    if (!shopId) {
      throw redirect({ to: '/studio', replace: true })
    }

    throw redirect({
      to: '/studio/$shopId/products',
      params: { shopId },
      search: {
        page: search.page,
        pageSize: search.pageSize,
        active: search.active,
        status: search.status,
        search: search.search,
      },
      replace: true,
    })
  },
})
