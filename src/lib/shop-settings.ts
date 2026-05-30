import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { validateVatId } from './vat'

export type { ShopRecord, UpdateShopInput } from './shop-settings.server'

/* -------------------------------------------------------------------------- */
/*                                   Schemas                                  */
/* -------------------------------------------------------------------------- */

const shippingOriginSchema = z
  .object({
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().length(2),
  })
  .optional()
  .nullable()

export const updateShopSchema = z
  .object({
    shopId: z.string().min(1, 'Shop ID is required.'),
    name: z.string().min(1).max(255).optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be URL-safe: lowercase letters, numbers, and hyphens only.',
      })
      .optional(),
    description: z.string().max(2000).optional(),
    shippingOrigin: shippingOriginSchema,
    isVatRegistered: z.boolean().optional(),
    vatId: z.string().optional().nullable(),
    image: z
      .string()
      .min(1)
      .regex(/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/, 'Invalid image key format')
      .optional()
      .nullable(),
    bannerImage: z
      .string()
      .min(1)
      .regex(/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/, 'Invalid image key format')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.isVatRegistered) {
      if (!data.vatId || data.vatId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'VAT ID is required when VAT registered',
          path: ['vatId'],
        })
        return
      }
      const validation = validateVatId(data.vatId.trim())
      if (!validation.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.message ?? 'Invalid VAT ID format',
          path: ['vatId'],
        })
      }
    }
  })

export const uploadShopImageSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required.'),
  key: z
    .string()
    .min(1)
    .regex(/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/, {
      message: 'Invalid image key format. Expected an S3 object key.',
    }),
})

export const checkSlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug must be URL-safe: lowercase letters, numbers, and hyphens only.',
    }),
  excludeShopId: z.string().optional(),
})

/* -------------------------------------------------------------------------- */
/*                              Server Functions                              */
/* -------------------------------------------------------------------------- */

/**
 * Updates the public-facing info of a shop: name, slug, and/or description.
 *
 * - Protected: only the shop owner (or admin) can call it.
 * - Slug changes are validated for platform-wide uniqueness.
 * - Returns 409 on slug collision with a clear error message.
 */
export const updateShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateShopSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { updateShopInternal, SlugCollisionError } = await import('./shop-settings.server')

    try {
      const { shopId, ...input } = data
      const record = await updateShopInternal(shopId, input)
      return {
        id: record.id,
        name: record.name,
        slug: record.slug,
        description: record.description,
        status: record.status,
        ownerId: record.ownerId,
        image: record.image,
        bannerImage: record.bannerImage,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        shippingOrigin: record.shippingOrigin as {
          street: string
          city: string
          postalCode: string
          country: string
        } | null,
        isVatRegistered: record.isVatRegistered,
        vatId: record.vatId,
      }
    } catch (err) {
      if (err instanceof SlugCollisionError) {
        throw new Response(
          JSON.stringify({
            error: 'Conflict',
            message: err.message,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw err
    }
  })

/**
 * Checks whether a slug is available for use.
 *
 * - Protected: only authenticated creators (or higher) can call it.
 * - When `excludeShopId` is provided, that shop's slug is ignored (for updates).
 * - Returns `{ available: true }` if the slug is not in use.
 */
export const checkShopSlug = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(checkSlugSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRole } = await import('./authz')
    requireRole('creator')({ user: context.user as never, session: {} as never })

    const { checkSlugUniquePlatformWide } = await import('./shop-settings.server')
    const available = await checkSlugUniquePlatformWide(data.slug, data.excludeShopId)
    return { available }
  })

/**
 * Updates a shop image reference and cleans up the old image from S3.
 *
 * - Protected: only the shop owner (or admin) can call it.
 * - Accepts an S3 object key (the client uploads directly to S3).
 * - Returns the key of the uploaded image.
 */
export const uploadShopImage = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(uploadShopImageSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { requireRole, requireShopOwnership } = await import('./authz')
    let ctx = requireRole('creator')({ user: context.user as never, session: {} as never })
    ctx = await requireShopOwnership(ctx, data.shopId)

    const { uploadShopImageInternal } = await import('./shop-settings.server')

    return await uploadShopImageInternal(data.shopId, data.key)
  })
