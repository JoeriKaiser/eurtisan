import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'

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

export const reportShop = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      reason: z.enum(['illegal', 'ip', 'fraud', 'offensive', 'other']),
      details: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { reportShopQuery } = await import('./shops/reports.server')
    return reportShopQuery(data.shopId, context.user.id, data.reason, data.details ?? null)
  })

export const getAdminShopReports = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user || context.user.role !== 'admin') throw new Error('FORBIDDEN')
    requirePrivileged2FA(context.user)
    const { listOpenShopReportsQuery } = await import('./shops/reports.server')
    return listOpenShopReportsQuery(data.page, data.pageSize)
  })

export const resolveShopReport = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      restrict: z.boolean(),
      ground: z.enum(['illegal', 'terms']),
      explanation: z.string().min(1).max(4000),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user || context.user.role !== 'admin') throw new Error('FORBIDDEN')
    requirePrivileged2FA(context.user)
    const { resolveShopReportQuery } = await import('./shops/reports.server')
    await resolveShopReportQuery(data.shopId, data.restrict, {
      ground: data.ground,
      explanation: data.explanation,
      actorUserId: context.user.id,
    })
    return { ok: true as const }
  })
