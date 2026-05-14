import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'

export type { AdminDashboardStats } from './admin-dashboard.server'
export type { RecentOrder, RecentSignup } from './admin-dashboard.server'

/**
 * Shared admin auth guard — throws 401/403 if not authenticated or not admin.
 */
async function requireAdmin(context: { user?: { id: string; role: string } | null }) {
  if (!context.user) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (context.user.role !== 'admin') {
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Admin access required.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/**
 * Returns aggregated platform-wide counts for the admin dashboard.
 * Only accessible by users with the admin role — returns 403 otherwise.
 */
export const getAdminDashboardStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context)

    const { getAdminDashboardStatsQuery } = await import('./admin-dashboard.server')
    return getAdminDashboardStatsQuery()
  })

/**
 * Returns the most recently registered users for the admin dashboard.
 * Only accessible by users with the admin role.
 */
export const getRecentSignups = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context)

    const { getRecentSignupsQuery } = await import('./admin-dashboard.server')
    return getRecentSignupsQuery(5)
  })

/**
 * Returns the most recently created platform orders for the admin dashboard.
 * Only accessible by users with the admin role.
 */
export const getRecentOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context)

    const { getRecentOrdersQuery } = await import('./admin-dashboard.server')
    return getRecentOrdersQuery(5)
  })
