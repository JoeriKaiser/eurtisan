import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth-middleware'

export type { ShopRecord, UpdateShopInput } from './shop-settings.server'
export { ImageValidationError, SlugCollisionError } from './shop-settings.server'

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

export const updateShopSchema = z.object({
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
})

export const uploadShopImageSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required.'),
  dataUrl: z
    .string()
    .min(1)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
      message: 'Invalid image data URL format. Expected a base64-encoded JPEG, PNG, or WebP image.',
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
        ...record,
        shippingOrigin: record.shippingOrigin as
          | { street: string; city: string; postalCode: string; country: string }
          | null,
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
 * Uploads a shop image (JPEG, PNG, or WebP, ≤5MB).
 *
 * - Protected: only the shop owner (or admin) can call it.
 * - Accepts a base64 data URL.
 * - Validates file type via MIME and magic bytes.
 * - Validates file size ≤5MB.
 * - Returns the public URL of the uploaded image.
 * - Returns a clear error message for invalid image types/sizes.
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

    const { uploadShopImageInternal, ImageValidationError } = await import('./shop-settings.server')

    try {
      return await uploadShopImageInternal(data.shopId, data.dataUrl)
    } catch (err) {
      if (err instanceof ImageValidationError) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Request',
            message: err.message,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw err
    }
  })
