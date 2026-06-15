import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'

export type {
  CreatorActivity,
  CreatorDashboardStats,
  CreatorShop,
  CreatorShopDetail,
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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { getCreatorShopsQuery } = await import('./creator-dashboard.server')
    return getCreatorShopsQuery(context.user.id)
  })

/**
 * Returns the full details for a specific shop owned by the authenticated creator.
 * Returns null if the shop does not exist or is not owned by the user.
 */
export const getCreatorShop = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1, 'Shop ID is required.'),
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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { getCreatorShopQuery } = await import('./creator-dashboard.server')
    return getCreatorShopQuery(context.user.id, data.shopId)
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

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { getCreatorRecentActivityQuery } = await import('./creator-dashboard.server')
    return getCreatorRecentActivityQuery(context.user.id, data.limit)
  })

/**
 * Returns dashboard stats scoped to a single shop.
 * The caller must own the shop.
 */
export const getShopDashboardStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1, 'Shop ID is required.'),
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

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { getShopDashboardStatsQuery } = await import('./creator-dashboard.server')
    return getShopDashboardStatsQuery(data.shopId)
  })
