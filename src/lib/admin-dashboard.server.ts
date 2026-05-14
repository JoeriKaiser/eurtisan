import { count, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { dispute, payout, shop, user } from '#/db/schema'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminDashboardStats {
  totalUsers: number
  activeShops: number
  openDisputes: number
  pendingPayouts: number
}

/* -------------------------------------------------------------------------- */
/*                            Dashboard Stats Query                           */
/* -------------------------------------------------------------------------- */

/**
 * Returns aggregated platform-wide counts for the admin dashboard.
 * Each metric returns as a number — zero when no records match.
 */
export async function getAdminDashboardStatsQuery(): Promise<AdminDashboardStats> {
  const [[totalUsersResult], [activeShopsResult], [openDisputesResult], [pendingPayoutsResult]] =
    await Promise.all([
      db.select({ count: count() }).from(user),
      db.select({ count: count() }).from(shop).where(eq(shop.isSuspended, false)),
      db.select({ count: count() }).from(dispute).where(eq(dispute.status, 'open')),
      db.select({ count: count() }).from(payout).where(eq(payout.status, 'pending')),
    ])

  return {
    totalUsers: Number(totalUsersResult?.count ?? 0),
    activeShops: Number(activeShopsResult?.count ?? 0),
    openDisputes: Number(openDisputesResult?.count ?? 0),
    pendingPayouts: Number(pendingPayoutsResult?.count ?? 0),
  }
}
