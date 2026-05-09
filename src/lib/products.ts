import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  slug: z.string().min(1).max(255),
  price: z.string().min(1).max(50),
  categoryId: z.string().uuid().optional(),
})

export const createProduct = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(createProductSchema.extend({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('Unauthorized')
    }

    const { requireShopOwnership } = await import('./authz')
    await requireShopOwnership({ user: context.user as never, session: {} as never }, data.shopId)

    const { createProductInternal } = await import('./products.server')
    return createProductInternal(data)
  })

export const listProductsByCategorySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { listProductsByCategorySlugQuery } = await import('./products.server')
    return listProductsByCategorySlugQuery(data.slug)
  })
