import { count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { dispute, payout, platformOrder, shop, user } from '#/db/schema'
import type { OrderStatus } from './orders.server'

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

/* -------------------------------------------------------------------------- */
/*                               Recent Signups                               */
/* -------------------------------------------------------------------------- */

export interface RecentSignup {
  id: string
  name: string
  email: string
  createdAt: Date
}

/**
 * Returns the most recently registered users, sorted newest first.
 */
export async function getRecentSignupsQuery(limit: number): Promise<RecentSignup[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(limit)

  return rows
}

/* -------------------------------------------------------------------------- */
/*                               Recent Orders                                */
/* -------------------------------------------------------------------------- */

export interface RecentOrder {
  id: string
  status: OrderStatus
  totalCents: number
  createdAt: Date
}

/**
 * Returns the most recently created platform orders, sorted newest first.
 */
export async function getRecentOrdersQuery(limit: number): Promise<RecentOrder[]> {
  const rows = await db
    .select({
      id: platformOrder.id,
      status: platformOrder.status,
      totalCents: platformOrder.totalCents,
      createdAt: platformOrder.createdAt,
    })
    .from(platformOrder)
    .orderBy(desc(platformOrder.createdAt))
    .limit(limit)

  return rows
}
