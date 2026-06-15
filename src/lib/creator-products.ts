import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'

export type { toggleProductActiveSchema } from './creator-products.schema'

import {
  bulkDeleteProductsSchema,
  bulkToggleProductActiveSchema,
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

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { createProductInternal } = await import('./creator-products.server')
    return createProductInternal(data, { id: context.user.id, name: context.user.name })
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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { updateProductInternal } = await import('./creator-products.server')
    return updateProductInternal(
      { ...data, shopId: data.shopId, userId: context.user.id },
      { id: context.user.id, name: context.user.name },
    )
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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { deleteProductInternal } = await import('./creator-products.server')
    return deleteProductInternal(
      { ...data, userId: context.user.id },
      { id: context.user.id, name: context.user.name },
    )
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

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { toggleProductActiveInternal } = await import('./creator-products.server')
    return toggleProductActiveInternal(
      { ...data, userId: context.user.id },
      { id: context.user.id, name: context.user.name },
    )
  })

/* -------------------------------------------------------------------------- */
/*                              Bulk Operations                               */
/* -------------------------------------------------------------------------- */

export const bulkToggleProductActive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(bulkToggleProductActiveSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { bulkToggleProductActiveInternal } = await import('./creator-products.server')
    return bulkToggleProductActiveInternal(
      { ...data, userId: context.user.id },
      { id: context.user.id, name: context.user.name },
    )
  })

export const bulkDeleteProducts = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(bulkDeleteProductsSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { bulkDeleteProductsInternal } = await import('./creator-products.server')
    return bulkDeleteProductsInternal(
      { ...data, userId: context.user.id },
      { id: context.user.id, name: context.user.name },
    )
  })
