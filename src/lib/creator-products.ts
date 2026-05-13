import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'

export type { toggleProductActiveSchema } from './creator-products.server'

/**
 * Returns a paginated, filterable list of products for a specific shop
 * owned by the authenticated creator.
 */
export const listCreatorProducts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, (data as { shopId: string }).shopId)

    const { listCreatorProductsInternal } = await import('./creator-products.server')
    return listCreatorProductsInternal(data as Parameters<typeof listCreatorProductsInternal>[0])
  })

/**
 * Toggles the active/inactive status of a product.
 * Only the shop owner can perform this action.
 */
export const toggleProductActive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const typedData = data as { productId: string; shopId: string }

    const { toggleProductActiveInternal } = await import('./creator-products.server')
    return toggleProductActiveInternal({ ...typedData, userId: context.user.id })
  })
