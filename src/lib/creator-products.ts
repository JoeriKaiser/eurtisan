import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type { toggleProductActiveSchema } from './creator-products.server'

const listCreatorProductsInputSchema = z.object({
  shopId: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  search: z.string().max(200).optional(),
})

/**
 * Returns a paginated, filterable list of products for a specific shop
 * owned by the authenticated creator.
 */
export const listCreatorProducts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listCreatorProductsInputSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { listCreatorProductsInternal } = await import('./creator-products.server')
    return listCreatorProductsInternal(data)
  })

const toggleProductActiveInputSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
})

/**
 * Toggles the active/inactive status of a product.
 * Only the shop owner can perform this action.
 */
export const toggleProductActive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(toggleProductActiveInputSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const { toggleProductActiveInternal } = await import('./creator-products.server')
    return toggleProductActiveInternal({ ...data, userId: context.user.id })
  })
