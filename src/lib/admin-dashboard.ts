import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'

export type { AdminDashboardStats } from './admin-dashboard.server'

/**
 * Returns aggregated platform-wide counts for the admin dashboard.
 * Only accessible by users with the admin role — returns 403 otherwise.
 */
export const getAdminDashboardStats = createServerFn({ method: 'GET' })
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

    if (context.user.role !== 'admin') {
      throw new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Admin access required.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getAdminDashboardStatsQuery } = await import('./admin-dashboard.server')
    return getAdminDashboardStatsQuery()
  })
