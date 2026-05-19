import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type { toggleProductActiveSchema } from './creator-products.server'

const productImageInputSchema = z.object({
  dataUrl: z
    .string()
    .min(1)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
      message: 'Invalid image data URL format',
    }),
  altText: z.string().max(500).optional(),
})

const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug must be URL-safe (lowercase letters, numbers, and hyphens only)',
    }),
  priceCents: z.number().int().positive(),
  stockCount: z.number().int().min(0).default(0),
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
  images: z.array(productImageInputSchema).max(10).optional().default([]),
})

const updateProductSchema = createProductSchema.partial().extend({
  productId: z.string().min(1),
  shopId: z.string().min(1),
  images: z.array(productImageInputSchema).max(10).optional(),
})

const deleteProductSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
  hard: z.boolean().default(false),
})

const listCreatorProductsInputSchema = z.object({
  shopId: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  search: z.string().max(200).optional(),
})

const toggleProductActiveInputSchema = z.object({
  productId: z.string().min(1),
  shopId: z.string().min(1),
})

const getCreatorProductDetailSchema = z.object({
  productId: z.string().min(1),
})

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
