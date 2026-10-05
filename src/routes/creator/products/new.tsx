import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'
import { getCreatorShops } from '#/lib/creator-dashboard'

const newProductSearchSchema = z.object({
  shopId: z.string().optional(),
})

export const Route = createFileRoute('/creator/products/new')({
  validateSearch: newProductSearchSchema,
  beforeLoad: async ({ search }) => {
    const shopId = search.shopId ?? (await getCreatorShops())[0]?.id
    if (!shopId) {
      throw redirect({ to: '/studio', replace: true })
    }

    throw redirect({
      to: '/studio/$shopId/products/new',
      params: { shopId },
      replace: true,
    })
  },
})
