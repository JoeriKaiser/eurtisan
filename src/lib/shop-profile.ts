import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

export type {
  ShopOriginSummary,
  ShopPolicySummary,
  ShopProductionType,
  ShopProfile,
  ShopRatingSummary,
  ShopSocialLink,
  ShopSocialPlatform,
} from './shops/public-profile'

export { SHOP_RATING_MIN_REVIEWS } from './shops/public-profile'

const getShopProfileSchema = z.object({
  slug: z.string().min(1).max(255),
})

/**
 * Public storefront profile for a shop.
 *
 * Throws `notFound()` for unknown, suspended, and non-active shops alike, so
 * suspension is not observable from outside.
 */
export const getShopProfile = createServerFn({
  method: 'GET',
})
  .inputValidator(getShopProfileSchema)
  .handler(async ({ data }) => {
    const { getShopProfileQuery } = await import('./shops/public-profile.server')
    const result = await getShopProfileQuery(data.slug)

    if (!result) {
      throw notFound()
    }

    return result
  })
