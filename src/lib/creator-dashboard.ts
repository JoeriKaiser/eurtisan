import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  CreatorActivity,
  CreatorDashboardStats,
  CreatorShop,
  OrderActivity,
  ReviewActivity,
} from './creator-dashboard.server'

/**
 * Returns aggregated dashboard stats for the authenticated creator.
 * Covers all shops owned by the user.
 */
export const getCreatorDashboardStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
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

    const { getCreatorDashboardStatsQuery } = await import('./creator-dashboard.server')
    return getCreatorDashboardStatsQuery(context.user.id)
  })

/**
 * Returns the list of shops owned by the authenticated creator.
 */
export const getCreatorShops = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
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

    const { getCreatorShopsQuery } = await import('./creator-dashboard.server')
    return getCreatorShopsQuery(context.user.id)
  })

/**
 * Returns a merged, chronologically sorted list of recent orders and reviews
 * across all shops owned by the authenticated creator.
 */
export const getCreatorRecentActivity = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(100).optional().default(20),
    }),
  )
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

    const { getCreatorRecentActivityQuery } = await import('./creator-dashboard.server')
    return getCreatorRecentActivityQuery(context.user.id, data.limit)
  })
