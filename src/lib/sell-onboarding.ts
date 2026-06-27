import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'
import { validateVatId } from './vat'
import { SUPPORTED_CURRENCY } from './currency'

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

export const SHOP_CATEGORIES = [
  'jewelry_accessories',
  'home_living',
  'art_collectibles',
  'clothing',
  'craft_supplies',
  'vintage',
  'digital_downloads',
  'other',
] as const

export const PRODUCTION_TYPES = ['handmade', 'vintage', 'supplies', 'digital', 'mixed'] as const

export const SOCIAL_PLATFORMS = [
  'website',
  'instagram',
  'pinterest',
  'tiktok',
  'facebook',
  'twitter',
  'youtube',
] as const

/* -------------------------------------------------------------------------- */
/*                                   Schemas                                  */
/* -------------------------------------------------------------------------- */

export const ALLOWED_COUNTRY_CODES = [
  'FR',
  'DE',
  'IT',
  'ES',
  'NL',
  'BE',
  'AT',
  'PT',
  'PL',
  'IE',
  'SE',
  'DK',
  'FI',
  'GB',
  'US',
  'CA',
  'AU',
  'CH',
  'NO',
] as const

export const ALLOWED_CURRENCIES = [SUPPORTED_CURRENCY] as const

const processingTimeSchema = z
  .object({
    min: z.number().int().min(1).max(90),
    max: z.number().int().min(1).max(90),
  })
  .refine((data) => data.min <= data.max, {
    message: 'Maximum processing days must be greater than or equal to minimum processing days',
    path: ['max'],
  })

const shippingOriginSchema = z.object({
  country: z.enum(ALLOWED_COUNTRY_CODES),
  state: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  processingTimeDays: processingTimeSchema,
  shipsInternational: z.boolean(),
})

export const policiesSchema = z.object({
  returns: z.object({
    accepted: z.boolean(),
    windowDays: z.number().int().optional(),
    conditions: z.string().max(500).optional(),
  }),
  exchanges: z.object({
    accepted: z.boolean(),
    conditions: z.string().max(500).optional(),
  }),
  customOrders: z.object({
    accepted: z.boolean(),
    details: z.string().max(500).optional(),
  }),
  paymentMethods: z.array(z.string()).default([]),
  additionalInfo: z.string().max(2000).optional(),
})

export const step1IdentitySchema = z.object({
  name: z
    .string()
    .min(4, 'Shop name must be at least 4 characters')
    .max(40, 'Shop name must be at most 40 characters')
    .regex(/^[a-zA-Z0-9 -]+$/, 'Only letters, numbers, spaces, and hyphens allowed'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(40, 'Slug must be at most 40 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  tagline: z.string().max(80).optional().or(z.literal('')),
  category: z.enum(SHOP_CATEGORIES),
  productionType: z.enum(PRODUCTION_TYPES),
})

export const step2StorySchema = z.object({
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(5000, 'Description must be at most 5000 characters'),
  tags: z.array(z.string().max(20)).max(13).default([]),
  languages: z.array(z.string()).default([]),
  hasProductionPartner: z.boolean().default(false),
  productionPartnerDetails: z.string().max(500).optional(),
})

export const step3VisualsSchema = z.object({
  image: z.string().optional(),
  bannerImage: z.string().optional(),
})

export const step4LocationSchema = z
  .object({
    shippingOrigin: shippingOriginSchema,
    currency: z.enum(ALLOWED_CURRENCIES),
    isVatRegistered: z.boolean().default(false),
    vatId: z.string().optional().or(z.literal('')),
    legalEntityType: z.enum(['individual', 'business']).default('individual'),
    dateOfBirth: z.string().optional().or(z.literal('')),
    taxId: z.string().optional().or(z.literal('')),
    businessRegistrationNumber: z.string().optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.isVatRegistered) {
      if (!data.vatId || data.vatId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'VAT ID is required when VAT registered',
          path: ['vatId'],
        })
      } else {
        const validation = validateVatId(data.vatId.trim())
        if (!validation.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: validation.message ?? 'Invalid VAT ID format',
            path: ['vatId'],
          })
        }
      }
    }
    if (!data.taxId || data.taxId.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tax Identification Number (TIN) is required for EU tax reporting',
        path: ['taxId'],
      })
    }
    if (data.legalEntityType === 'individual') {
      if (!data.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date of birth is required in YYYY-MM-DD format for individual sellers',
          path: ['dateOfBirth'],
        })
      }
    } else if (data.legalEntityType === 'business') {
      if (!data.businessRegistrationNumber || data.businessRegistrationNumber.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Business registration number is required for corporate sellers',
          path: ['businessRegistrationNumber'],
        })
      }
    }
  })

export const step5PoliciesSchema = z.object({
  policies: policiesSchema.optional(),
})

export type Policies = z.infer<typeof policiesSchema>

export const socialRowSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string().min(1),
})

export type SocialRow = z.infer<typeof socialRowSchema>

export const step6SocialsSchema = z.object({
  socials: z.array(socialRowSchema).default([]),
})

const listingImageSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/, 'Invalid image key format'),
  altText: z.string().max(500).optional(),
})

export const step7ListingSchema = z.object({
  name: z.string().min(5).max(140),
  description: z.string().min(20).max(2000),
  priceCents: z.number().int().min(50).max(1_000_000_00),
  stockCount: z.number().int().min(0).default(1),
  categoryId: z.string().uuid().optional(),
  images: z.array(listingImageSchema).min(1).max(5),
})

export const step8ReviewSchema = z.object({
  termsAgreed: z.literal(true),
})

export type Step1Identity = z.infer<typeof step1IdentitySchema>
export type Step2Story = z.infer<typeof step2StorySchema>
export type Step3Visuals = z.infer<typeof step3VisualsSchema>
export type Step4Location = z.infer<typeof step4LocationSchema>
export type Step5Policies = z.infer<typeof step5PoliciesSchema>
export type Step6Socials = z.infer<typeof step6SocialsSchema>
export type Step7Listing = z.infer<typeof step7ListingSchema>

/* -------------------------------------------------------------------------- */
/*                                 Helpers                                    */
/* -------------------------------------------------------------------------- */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export function suggestSlug(name: string): string {
  const base = slugify(name)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export interface ShippingOriginData {
  country: string
  state?: string
  city?: string
  postalCode?: string
  processingTimeDays: { min: number; max: number }
  shipsInternational: boolean
}

export interface PoliciesData {
  returns: { accepted: boolean; windowDays?: number; conditions?: string }
  exchanges: { accepted: boolean; conditions?: string }
  customOrders: { accepted: boolean; details?: string }
  paymentMethods: string[]
  additionalInfo?: string
}

export interface ShopDraft {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  category: string | null
  tags: string[]
  image: string | null
  bannerImage: string | null
  productionType: string | null
  hasProductionPartner: boolean | null
  productionPartnerDetails: string | null
  languages: string[]
  shippingOrigin: ShippingOriginData | null
  currency: string
  isVatRegistered: boolean
  vatId: string | null
  legalEntityType: string | null
  dateOfBirth: string | null
  taxId: string | null
  businessRegistrationNumber: string | null
  policies: PoliciesData | null
  announcement: string | null
  status: string
  onboardingStep: number
  onboardingCompletedAt: Date | null
  isSuspended: boolean
  moderationNote: string | null
  submittedAt: Date | null
  reviewedAt: Date | null
  reviewedBy: string | null
  resubmissionCount: number
  mollieAccountId: string | null
  paymentConnected: boolean
  paymentConnectedAt: Date | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
  socials: { id: string; shopId: string; platform: string; url: string }[]
}

/* -------------------------------------------------------------------------- */
/*                              Server Functions                              */
/* -------------------------------------------------------------------------- */

/**
 * Creates a new draft shop for the authenticated user.
 * Returns the new shop id.
 */
export const createShopDraft = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')
    const { createShopDraftInternal } = await import('./sell-onboarding.server')
    return createShopDraftInternal(context.user)
  })

/**
 * Returns the full draft/shop data with socials for the authenticated owner.
 */
export const getShopDraft = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { draftId: string }) => data)
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')
    const { getShopDraftQuery } = await import('./sell-onboarding.server')
    return getShopDraftQuery(data.draftId, context.user.id, context.user.role)
  })

/**
 * Validates onboarding step data using the same schemas as the client.
 * Rejects unknown or malformed fields before persistence.
 */
export function validateOnboardingStepData(step: number, data: unknown): void {
  switch (step) {
    case 1:
      step1IdentitySchema.parse(data)
      break
    case 2:
      step2StorySchema.parse(data)
      break
    case 3:
      step3VisualsSchema.parse(data)
      break
    case 4:
      step4LocationSchema.parse(data)
      break
    case 5:
      step5PoliciesSchema.parse(data)
      break
    case 6:
      step6SocialsSchema.parse(data)
      break
    case 7:
      // Step 7 listing data is persisted via createDraftListing, not saveOnboardingStep.
      // Reject any injected fields to prevent cross-step mutation.
      z.object({}).strict().parse(data)
      break
    case 8:
      step8ReviewSchema.parse(data)
      break
    default:
      throw new Error(`Invalid onboarding step: ${step}`)
  }
}

/**
 * Saves a specific onboarding step for a draft shop.
 * Partial updates are allowed.
 */
export const saveOnboardingStep = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      draftId: z.string().min(1),
      step: z.number().int().min(1).max(8),
      data: z.record(z.unknown()),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')

    // Validate step data server-side before persisting
    validateOnboardingStepData(data.step, data.data)

    const { saveOnboardingStepInternal } = await import('./sell-onboarding.server')
    return saveOnboardingStepInternal(context.user.id, context.user.role, data)
  })

/**
 * Checks if a shop slug is available globally.
 */
export const checkSlugAvailability = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ slug: z.string().min(1), excludeShopId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { checkSlugAvailabilityInternal } = await import('./sell-onboarding.server')
    return checkSlugAvailabilityInternal(data.slug, data.excludeShopId)
  })

/**
 * Checks a shop name for duplicates and profanity.
 */
export const checkShopName = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ name: z.string().min(1), excludeShopId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { checkShopNameInternal } = await import('./sell-onboarding.server')
    return checkShopNameInternal(data.name, data.excludeShopId)
  })

/**
 * Returns all shops belonging to the authenticated seller.
 */
export const getSellerShops = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')
    const { getSellerShopsInternal } = await import('./sell-onboarding.server')
    return getSellerShopsInternal(context.user.id)
  })

/**
 * Submits a draft shop for admin review.
 * Requires at least one listing (product) attached to the shop.
 */
export const submitShopForReview = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ draftId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')
    const { submitShopForReviewInternal } = await import('./sell-onboarding.server')
    return submitShopForReviewInternal(context.user.id, context.user.role, data.draftId)
  })

/**
 * Returns the shop status data for the seller status page.
 */
export const getShopStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { shopId: string }) => data)
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')
    const { getShopStatusInternal } = await import('./sell-onboarding.server')
    return getShopStatusInternal(context.user.id, context.user.role, data.shopId)
  })

/**
 * Creates a draft listing (product) attached to a draft shop.
 * The product is created with isActive: false.
 */
export const createDraftListing = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    step7ListingSchema.extend({
      draftId: z.string().min(1),
      slug: z
        .string()
        .min(1)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')

    const { verifyShopOwnershipOrAdmin } = await import('./sell-onboarding.server')
    const record = await verifyShopOwnershipOrAdmin(
      data.draftId,
      context.user.id,
      context.user.role,
    )

    if (record.status !== 'draft' && record.status !== 'changes_requested') {
      throw new Error('FORBIDDEN')
    }

    const { createProductInternal } = await import('./creator-products.server')

    const created = await createProductInternal({
      name: data.name,
      description: data.description,
      slug: data.slug,
      priceCents: data.priceCents,
      stockCount: data.stockCount,
      shopId: data.draftId,
      categoryId: data.categoryId,
      isActive: false,
      images: data.images,
    })

    return created
  })

/* -------------------------------------------------------------------------- */
/*                              Admin Functions                               */
/* -------------------------------------------------------------------------- */

const moderationActionSchema = z.object({
  shopId: z.string().min(1),
  action: z.enum(['approve', 'request_changes', 'reject']),
  note: z.string().optional(),
})

/**
 * Returns all shops awaiting moderation.
 * Admin only.
 */
export const getShopsForModeration = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      status: z
        .enum(['pending_review', 'changes_requested', 'approved', 'rejected', 'all'])
        .optional()
        .default('all'),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user || context.user.role !== 'admin') throw new Error('FORBIDDEN')
    requirePrivileged2FA(context.user as SafeUser)
    const [{ getShopsForModerationInternal }, { emitAdminReadAudit }] = await Promise.all([
      import('./sell-onboarding.server'),
      import('./audit-log.server'),
    ])
    const result = await getShopsForModerationInternal(data.status)

    await emitAdminReadAudit(context.user, 'admin.read.shop', 'shop', undefined, {
      status: data.status,
      count: result.length,
    })

    return result
  })

export const moderateShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(moderationActionSchema)
  .handler(async ({ context, data }) => {
    if (!context.user || context.user.role !== 'admin') throw new Error('FORBIDDEN')
    requirePrivileged2FA(context.user as SafeUser)
    const [{ moderateShopInternal }, { emitAuditEvent }] = await Promise.all([
      import('./sell-onboarding.server'),
      import('./audit-log.server'),
    ])
    const [result] = await Promise.all([
      moderateShopInternal(context.user.id, data),
      emitAuditEvent(context.user, `shop.${data.action}`, 'shop', data.shopId, {
        note: data.note,
      }),
    ])

    return result
  })

/**
 * Fetch draft listings for a shop. Accessible by owner or admin.
 */
export const getShopDraftListings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error('UNAUTHENTICATED')
    const [{ verifyShopOwnershipOrAdmin }, { listCreatorProductsInternal }] = await Promise.all([
      import('./sell-onboarding.server'),
      import('./creator-products.server'),
    ])
    await verifyShopOwnershipOrAdmin(data.shopId, context.user.id, context.user.role)

    return listCreatorProductsInternal({
      shopId: data.shopId,
      page: 1,
      pageSize: 50,
      active: 'all',
    })
  })
