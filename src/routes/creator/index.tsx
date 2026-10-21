import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

const creatorSearchSchema = z.object({
  shopId: z.string().optional(),
})

export const Route = createFileRoute('/creator/')({
  validateSearch: creatorSearchSchema,
  beforeLoad: ({ search }) => {
    if (search.shopId) {
      throw redirect({
        to: '/studio/$shopId',
        params: { shopId: search.shopId },
        replace: true,
      })
    }

    throw redirect({
      to: '/studio',
      replace: true,
    })
  },
})
