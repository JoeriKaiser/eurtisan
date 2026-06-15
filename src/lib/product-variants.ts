import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'

export type { ProductVariantMatrix } from './product-variants.server'
import {
  createProductOptionSchema,
  createProductVariantSchema,
  deleteProductOptionSchema,
  deleteProductVariantSchema,
  ensureVariantMatrixSchema,
  getProductVariantDetailSchema,
  updateProductOptionSchema,
  updateProductVariantSchema,
} from './product-variants.schema'

export const getProductVariantMatrix = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(getProductVariantDetailSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { verifyProductOwnershipForVariants, getProductVariantMatrix: getMatrix } = await import(
      './product-variants.server'
    )
    await verifyProductOwnershipForVariants(data.productId, context.user.id)
    return getMatrix(data.productId)
  })

export const createProductOption = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createProductOptionSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { verifyProductOwnershipForVariants, createProductOptionQuery } = await import(
      './product-variants.server'
    )
    await verifyProductOwnershipForVariants(data.productId, context.user.id)

    return createProductOptionQuery(
      data.productId,
      { name: data.name, values: data.values },
      { id: context.user.id, name: context.user.name },
    )
  })

export const updateProductOption = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateProductOptionSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    requirePrivileged2FA(context.user as SafeUser)

    const { updateProductOptionQuery } = await import('./product-variants.server')
    return updateProductOptionQuery(
      data.optionId,
      { name: data.name, values: data.values },
      { id: context.user.id, name: context.user.name },
    )
  })

export const deleteProductOption = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteProductOptionSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    requirePrivileged2FA(context.user as SafeUser)

    const { deleteProductOptionQuery } = await import('./product-variants.server')
    return deleteProductOptionQuery(data.optionId, { id: context.user.id, name: context.user.name })
  })

export const createProductVariant = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(createProductVariantSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { verifyProductOwnershipForVariants, createProductVariantQuery } = await import(
      './product-variants.server'
    )
    await verifyProductOwnershipForVariants(data.productId, context.user.id)

    return createProductVariantQuery(
      data.productId,
      {
        name: data.name,
        sku: data.sku,
        priceAdjustmentCents: data.priceAdjustmentCents,
        stockCount: data.stockCount,
        isActive: data.isActive,
        optionValueIds: data.optionValueIds,
      },
      { id: context.user.id, name: context.user.name },
    )
  })

export const updateProductVariant = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateProductVariantSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    requirePrivileged2FA(context.user as SafeUser)

    const { updateProductVariantQuery } = await import('./product-variants.server')
    return updateProductVariantQuery(
      data.variantId,
      {
        name: data.name,
        sku: data.sku,
        priceAdjustmentCents: data.priceAdjustmentCents,
        stockCount: data.stockCount,
        isActive: data.isActive,
        optionValueIds: data.optionValueIds,
      },
      { id: context.user.id, name: context.user.name },
    )
  })

export const deleteProductVariant = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteProductVariantSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    requirePrivileged2FA(context.user as SafeUser)

    const { deleteProductVariantQuery } = await import('./product-variants.server')
    return deleteProductVariantQuery(data.variantId, {
      id: context.user.id,
      name: context.user.name,
    })
  })

export const ensureVariantMatrix = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(ensureVariantMatrixSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { verifyProductOwnershipForVariants, ensureVariantMatrixQuery } = await import(
      './product-variants.server'
    )
    await verifyProductOwnershipForVariants(data.productId, context.user.id)

    return ensureVariantMatrixQuery(data.productId, {
      id: context.user.id,
      name: context.user.name,
    })
  })
