/**
 * Browser-safe contract for the public shop storefront.
 *
 * The `shop` table mixes public marketing data with tax identity and payment
 * credentials in a single row, so what a buyer may see is defined here as an
 * explicit allowlist rather than as "the shop record minus a few fields".
 *
 * This module must not import database code, secrets, or `*.server.ts` modules.
 */

import z from 'zod'
import { PRODUCTION_TYPES, policiesSchema, SOCIAL_PLATFORMS } from '../sell-onboarding'

/**
 * Minimum number of reviews before a shop-level rating is shown at all.
 *
 * A single five-star review is not evidence. The same caution is encoded in
 * `computeBayesianRating`'s prior for search ranking; here it is simpler to
 * withhold the number than to explain it.
 */
export const SHOP_RATING_MIN_REVIEWS = 3

export type ShopProductionType = (typeof PRODUCTION_TYPES)[number]
export type ShopSocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

/**
 * Publishable subset of `shop.policies`.
 *
 * `paymentMethods` is deliberately dropped: it is seller-declared and does not
 * reflect what checkout actually offers, so publishing it would mislead.
 */
export const publicPoliciesSchema = policiesSchema.omit({ paymentMethods: true })

export type ShopPolicySummary = z.infer<typeof publicPoliciesSchema>

/**
 * Publishable subset of `shop.shippingOrigin`.
 *
 * The stored object also carries `state`, `city`, and `postalCode`. Those are
 * seller PII — the column is encrypted at rest for that reason — and are never
 * published. The country is accepted as any two-letter code rather than as the
 * write-path country enum so that a legacy or out-of-list value degrades to a
 * hidden field instead of discarding the processing times alongside it.
 *
 * Only `country` is required. Onboarding always collects the other two
 * (`sell-onboarding.ts` makes both mandatory), but the settings write path
 * (`shop-settings.ts`) validates a narrower object — street, city, postal code,
 * country — and replaces the stored value wholesale, so a seller who edits
 * their dispatch address loses the processing times. Requiring them here would
 * turn that upstream data loss into a storefront where the whole origin line
 * silently disappears; the country alone is still true and still useful.
 */
export const publicOriginSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  processingTimeDays: z
    .object({
      min: z.number().int().min(1).max(90),
      max: z.number().int().min(1).max(90),
    })
    .optional(),
  shipsInternational: z.boolean().optional(),
})

export type ShopOriginSummary = z.infer<typeof publicOriginSchema>

/**
 * A social link that is safe to render.
 *
 * `socialRowSchema` on the write path accepts any non-empty string, so a
 * `javascript:` value can already be stored. Restricting the scheme here is the
 * first of two layers; the render site re-checks it.
 */
export const publicSocialSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z
    .string()
    .url()
    .refine((value) => {
      try {
        const { protocol } = new URL(value)
        return protocol === 'http:' || protocol === 'https:'
      } catch {
        return false
      }
    }, 'Only http(s) links may be published'),
})

export type ShopSocialLink = z.infer<typeof publicSocialSchema>

export interface ShopRatingSummary {
  /** Reviews counted, excluding hidden ones. */
  reviewCount: number
  /** Plain arithmetic mean, rounded to two decimals. */
  ratingAverage: number
}

/**
 * Everything a buyer may see about a shop.
 *
 * Adding a field here is a publishing decision. `src/lib/shops/public-profile.server.test.ts`
 * asserts the exact key set, so widening this type without widening that test
 * fails the suite on purpose.
 */
export interface ShopProfile {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  category: string | null
  tags: string[]
  image: string | null
  bannerImage: string | null
  announcement: string | null
  productionType: ShopProductionType | null
  hasProductionPartner: boolean
  productionPartnerDetails: string | null
  languages: string[]
  isVatRegistered: boolean
  createdAt: Date
  /** Null when absent or when the stored value fails validation. */
  policies: ShopPolicySummary | null
  /** Null when absent or when the stored value fails validation. */
  origin: ShopOriginSummary | null
  socials: ShopSocialLink[]
  /** Null below {@link SHOP_RATING_MIN_REVIEWS}. */
  rating: ShopRatingSummary | null
  productCount: number
}

/**
 * Parses a stored value into its publishable form, returning null when it does
 * not validate.
 *
 * A malformed row must degrade to a sparser page, never to a failed render:
 * these are anonymous, server-rendered pages and the stored JSONB predates
 * several schema revisions.
 */
export function parsePublicPolicies(value: unknown): ShopPolicySummary | null {
  const parsed = publicPoliciesSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parsePublicOrigin(value: unknown): ShopOriginSummary | null {
  const parsed = publicOriginSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Drops any row that fails validation rather than failing the whole list. */
export function parsePublicSocials(rows: readonly unknown[]): ShopSocialLink[] {
  return rows.flatMap((row) => {
    const parsed = publicSocialSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

export function isPublishableProductionType(value: string | null): value is ShopProductionType {
  return value !== null && (PRODUCTION_TYPES as readonly string[]).includes(value)
}

/**
 * The optional profile fields a seller controls, used to score completeness.
 *
 * Deliberately excludes `name`, `slug`, and `createdAt` (mandatory, so scoring
 * them inflates every shop), `isVatRegistered` and `hasProductionPartner`
 * (booleans where `false` is a real answer, not an omission), and
 * `productionPartnerDetails` (only meaningful when the partner flag is set).
 */
export const SHOP_PROFILE_SCORED_FIELDS = [
  'tagline',
  'description',
  'category',
  'tags',
  'image',
  'bannerImage',
  'announcement',
  'productionType',
  'languages',
  'policies',
  'origin',
  'socials',
] as const

/** Presence of each scored field, as the completeness job observes it. */
export type ShopProfileFieldPresence = Record<(typeof SHOP_PROFILE_SCORED_FIELDS)[number], boolean>

/**
 * Fraction of {@link SHOP_PROFILE_SCORED_FIELDS} a shop has filled in, 0–1.
 *
 * Feeds `eurtisan_shop_profile_completeness`. Kept pure and separate from the
 * query so the definition of "complete" is testable without a database and does
 * not drift between the job and anything that later reports the same number to
 * sellers.
 */
export function scoreShopProfileCompleteness(presence: ShopProfileFieldPresence): number {
  const populated = SHOP_PROFILE_SCORED_FIELDS.filter((field) => presence[field]).length
  return populated / SHOP_PROFILE_SCORED_FIELDS.length
}
