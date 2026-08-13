import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'
import { validateVatId } from './vat'
import { policiesSchema, socialRowSchema, type Policies, type SocialRow } from './sell-onboarding'
import { traderStatusSchema, type TraderStatus } from './shops/trader-status'

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

const businessAddressSchema = z
  .object({
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().length(2),
  })
  .optional()
  .nullable()

const dateStringSchema = z
  .string()
  .optional()
  .nullable()
  .refine((value) => {
    if (!value || value.trim().length === 0) return true
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
  }, 'Date must be in YYYY-MM-DD format')

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
    businessAddress: businessAddressSchema,
    isVatRegistered: z.boolean().optional(),
    vatId: z.string().optional().nullable(),
    legalEntityType: z.enum(['individual', 'business']).optional().nullable(),
    traderStatus: traderStatusSchema.optional(),
    dateOfBirth: dateStringSchema,
    taxId: z.string().optional().nullable(),
    businessRegistrationNumber: z.string().optional().nullable(),
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
    announcement: z.string().max(500).optional().nullable(),
    policies: policiesSchema.optional().nullable(),
    socials: z.array(socialRowSchema).optional(),
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
    if (data.legalEntityType === 'individual') {
      if (!data.dateOfBirth || data.dateOfBirth.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date of birth is required for individual sellers',
          path: ['dateOfBirth'],
        })
      }
    } else if (data.legalEntityType === 'business') {
      if (!data.businessRegistrationNumber || data.businessRegistrationNumber.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Business registration number is required for business sellers',
          path: ['businessRegistrationNumber'],
        })
      }
    }
    if (data.taxId !== undefined && data.taxId !== null && data.taxId.trim().length > 0) {
      if (!/^[A-Za-z0-9-]{3,30}$/.test(data.taxId.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tax ID must be 3–30 alphanumeric characters',
          path: ['taxId'],
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

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { updateShopInternal, SlugCollisionError } = await import('./shop-settings.server')
    // Dynamic, like every other server-only import in this handler: this module
    // is reachable from the browser graph and `encryption.server` must not be.
    const { decryptJsonb } = await import('./encryption.server')
    const { db } = await import('#/db/index')
    const { shopSocials } = await import('#/db/schema')
    const { eq } = await import('drizzle-orm')
    const { emitAuditEvent } = await import('./audit-log.server')

    try {
      const { shopId, ...input } = data
      const record = await updateShopInternal(shopId, input)

      // Audit DAC7 tax identity updates.
      const dac7Fields: (keyof typeof input)[] = [
        'taxId',
        'legalEntityType',
        'dateOfBirth',
        'businessRegistrationNumber',
      ]
      const updatedDac7Fields = dac7Fields.filter((field) => input[field] !== undefined)
      if (updatedDac7Fields.length > 0) {
        emitAuditEvent(context.user as SafeUser, 'shop_tax_identity_updated', 'shop', shopId, {
          fields: updatedDac7Fields,
        })
      }

      if (input.traderStatus !== undefined) {
        emitAuditEvent(context.user as SafeUser, 'shop_trader_status_updated', 'shop', shopId, {
          traderStatus: input.traderStatus,
        })
      }

      const socials = await db.select().from(shopSocials).where(eq(shopSocials.shopId, shopId))
      return {
        id: record.id,
        name: record.name,
        slug: record.slug,
        description: record.description,
        status: record.status,
        ownerId: record.ownerId,
        image: record.image,
        bannerImage: record.bannerImage,
        announcement: record.announcement,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        // Both columns are encrypted at rest by `updateShopInternal`. Read raw,
        // the settings form renders empty address fields for a seller who has an
        // address stored.
        shippingOrigin: decryptJsonb<{
          street: string
          city: string
          postalCode: string
          country: string
        } | null>(record.shippingOrigin),
        businessAddress: decryptJsonb<{
          street: string
          city: string
          postalCode: string
          country: string
        } | null>(record.businessAddress),
        isVatRegistered: record.isVatRegistered,
        vatId: record.vatId,
        legalEntityType: record.legalEntityType as 'individual' | 'business' | null,
        traderStatus: record.traderStatus as TraderStatus | null,
        dateOfBirth: record.dateOfBirth,
        taxId: record.taxId,
        businessRegistrationNumber: record.businessRegistrationNumber,
        policies: (record.policies as Policies | null) ?? null,
        socials: socials.map(
          (s): SocialRow => ({
            platform: s.platform as SocialRow['platform'],
            url: s.url,
          }),
        ),
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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

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

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { uploadShopImageInternal } = await import('./shop-settings.server')

    return await uploadShopImageInternal(data.shopId, data.key)
  })
