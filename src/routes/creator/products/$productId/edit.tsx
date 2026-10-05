import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'
import { getCreatorProductDetail } from '#/lib/creator-products'

const editSearchSchema = z.object({
  shopId: z.string().optional(),
})

export const Route = createFileRoute('/creator/products/$productId/edit')({
  validateSearch: editSearchSchema,
  beforeLoad: async ({ params, search }) => {
    let shopId = search.shopId
    if (!shopId) {
      const product = await getCreatorProductDetail({ data: { productId: params.productId } })
      shopId = product?.shopId
    }

    if (!shopId) {
      throw redirect({ to: '/studio', replace: true })
    }

    throw redirect({
      to: '/studio/$shopId/products/$productId/edit',
      params: { shopId, productId: params.productId },
      replace: true,
    })
  },
})
