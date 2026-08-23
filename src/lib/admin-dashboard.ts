import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'
import { requireAdminSignInResponse } from './authz'
import type { SafeUser } from './server-auth'
import { requirePrivileged2FA } from './server-auth'

export type { AdminDashboardStats, RecentOrder, RecentSignup } from './admin-dashboard.server'

/**
 * Returns the current number of seller applications awaiting review.
 * The admin layout uses this aggregate to keep the review queue visible.
 */
export const getPendingShopReviewCount = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const { getPendingShopReviewCountQuery } = await import('./admin-dashboard.server')
    return getPendingShopReviewCountQuery()
  })

/**
 * Returns aggregated platform-wide counts for the admin dashboard.
 * Only accessible by users with the admin role — returns 403 otherwise.
 */
export const getAdminDashboardStats = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ getAdminDashboardStatsQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-dashboard.server'),
      import('./audit-log.server'),
    ])
    const result = await getAdminDashboardStatsQuery()

    await emitAdminReadAudit(context.user, 'admin.read.dashboard', 'dashboard', undefined, {
      totalUsers: result.totalUsers,
      activeShops: result.activeShops,
      openDisputes: result.openDisputes,
      pendingPayouts: result.pendingPayouts,
    })

    return result
  })

/**
 * Returns the most recently registered users for the admin dashboard.
 * Only accessible by users with the admin role.
 */
export const getRecentSignups = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ getRecentSignupsQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-dashboard.server'),
      import('./audit-log.server'),
    ])
    const result = await getRecentSignupsQuery(5)

    await emitAdminReadAudit(context.user, 'admin.read.user', 'user', undefined, {
      limit: 5,
      count: result.length,
    })

    return result
  })

/**
 * Returns the most recently created platform orders for the admin dashboard.
 * Only accessible by users with the admin role.
 */
export const getRecentOrders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ getRecentOrdersQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-dashboard.server'),
      import('./audit-log.server'),
    ])
    const result = await getRecentOrdersQuery(5)

    await emitAdminReadAudit(context.user, 'admin.read.order', 'order', undefined, {
      limit: 5,
      count: result.length,
    })

    return result
  })

/**
 * Returns daily trend aggregates for the admin dashboard.
 * Only accessible by users with the admin role.
 */
export const getDashboardTrends = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ getDashboardTrendsQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-dashboard.server'),
      import('./audit-log.server'),
    ])
    const result = await getDashboardTrendsQuery(30)

    await emitAdminReadAudit(context.user, 'admin.read.dashboard', 'dashboard', undefined, {
      days: 30,
    })

    return result
  })

/**
 * Returns the most recent audit log entries for the admin dashboard.
 * Only accessible by users with the admin role.
 */
export const getRecentAuditEntries = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminSignInResponse(context)
    requirePrivileged2FA(context.user as SafeUser)

    const [{ getRecentAuditEntriesQuery }, { emitAdminReadAudit }] = await Promise.all([
      import('./admin-dashboard.server'),
      import('./audit-log.server'),
    ])
    const result = await getRecentAuditEntriesQuery(5)

    await emitAdminReadAudit(context.user, 'admin.read.audit_log', 'audit_log', undefined, {
      limit: 5,
      count: result.length,
    })

    return result
  })
