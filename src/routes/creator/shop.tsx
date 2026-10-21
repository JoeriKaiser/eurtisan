import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'
import { getCreatorShops } from '#/lib/creator-dashboard'

const shopSearchSchema = z.object({
  shopId: z.string().optional(),
})

export const Route = createFileRoute('/creator/shop')({
  validateSearch: shopSearchSchema,
  beforeLoad: async ({ search }) => {
    const shopId = search.shopId ?? (await getCreatorShops())[0]?.id
    if (!shopId) {
      throw redirect({ to: '/studio', replace: true })
    }

    throw redirect({
      to: '/studio/$shopId/settings',
      params: { shopId },
      replace: true,
    })
  },
})
