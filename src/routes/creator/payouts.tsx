import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'
import { getCreatorShops } from '#/lib/creator-dashboard'

const payoutSearchSchema = z.object({
  shopId: z.string().optional(),
  status: z.enum(['all', 'pending', 'in_transit', 'sent', 'failed', 'reversed']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/creator/payouts')({
  validateSearch: payoutSearchSchema,
  beforeLoad: async ({ search }) => {
    const shopId = search.shopId ?? (await getCreatorShops())[0]?.id
    if (!shopId) {
      throw redirect({ to: '/studio', replace: true })
    }

    throw redirect({
      to: '/studio/$shopId/payouts',
      params: { shopId },
      search: {
        status: search.status,
        page: search.page,
      },
      replace: true,
    })
  },
})
