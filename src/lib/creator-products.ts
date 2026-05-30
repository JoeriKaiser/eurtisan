import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type { toggleProductActiveSchema } from './creator-products.schema'

import {
  createProductSchema,
  deleteProductSchema,
  getCreatorProductDetailSchema,
  listCreatorProductsSchema,
  toggleProductActiveSchema,
  updateProductSchema,
} from './creator-products.schema'

/* -------------------------------------------------------------------------- */
/*                               Create Product                               */
/* -------------------------------------------------------------------------- */

export const createProduct = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createProductSchema.extend({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { createProductInternal } = await import('./creator-products.server')
    return createProductInternal(data)
  })

/* -------------------------------------------------------------------------- */
/*                               Update Product                               */
/* -------------------------------------------------------------------------- */

export const updateProduct = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateProductSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const { updateProductInternal } = await import('./creator-products.server')
    return updateProductInternal({ ...data, shopId: data.shopId, userId: context.user.id })
  })

/* -------------------------------------------------------------------------- */
/*                               Delete Product                               */
/* -------------------------------------------------------------------------- */

export const deleteProduct = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteProductSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const { deleteProductInternal } = await import('./creator-products.server')
    return deleteProductInternal({ ...data, userId: context.user.id })
  })

/* -------------------------------------------------------------------------- */
/*                             List Products                                  */
/* -------------------------------------------------------------------------- */

export const listCreatorProducts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listCreatorProductsSchema)
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

/* -------------------------------------------------------------------------- */
/*                            Get Product Detail                              */
/* -------------------------------------------------------------------------- */

export const getCreatorProductDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(getCreatorProductDetailSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const { getCreatorProductDetailInternal } = await import('./creator-products.server')
    return getCreatorProductDetailInternal(data.productId, context.user.id)
  })

/* -------------------------------------------------------------------------- */
/*                               Toggle Active                                */
/* -------------------------------------------------------------------------- */

export const toggleProductActive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(toggleProductActiveSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const { toggleProductActiveInternal } = await import('./creator-products.server')
    return toggleProductActiveInternal({ ...data, userId: context.user.id })
  })
