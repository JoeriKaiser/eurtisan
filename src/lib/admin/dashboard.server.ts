import { count, desc, eq, gte, sql, sum } from 'drizzle-orm'
import { db } from '#/db/index'
import { auditLog, dispute, payout, platformOrder, shop, user } from '#/db/schema'
import type { OrderStatus } from '../orders.server'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminDashboardStats {
  totalUsers: number
  activeShops: number
  openDisputes: number
  pendingPayouts: number
}

export async function getPendingShopReviewCountQuery(): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(shop)
    .where(eq(shop.status, 'pending_review'))

  return Number(result?.count ?? 0)
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

/* -------------------------------------------------------------------------- */
/*                               Trend Data                                   */
/* -------------------------------------------------------------------------- */

export interface DailyTrendPoint {
  date: string // ISO date string YYYY-MM-DD
  value: number
}

export interface DashboardTrends {
  signups: DailyTrendPoint[]
  revenue: DailyTrendPoint[]
  orders: DailyTrendPoint[]
  disputes: DailyTrendPoint[]
}

/**
 * Returns daily aggregates for the last `days` days.
 * Each series is padded with zeroes for days that have no data,
 * so every series has exactly `days` entries ordered oldest → newest.
 */
export async function getDashboardTrendsQuery(days: number): Promise<DashboardTrends> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  const dateTrunc = sql<string>`DATE_TRUNC('day', ${platformOrder.createdAt})::date`
  const userDateTrunc = sql<string>`DATE_TRUNC('day', ${user.createdAt})::date`
  const disputeDateTrunc = sql<string>`DATE_TRUNC('day', ${dispute.createdAt})::date`

  const [signupRows, revenueRows, orderRows, disputeRows] = await Promise.all([
    db
      .select({
        date: userDateTrunc,
        count: count(),
      })
      .from(user)
      .where(gte(user.createdAt, startDate))
      .groupBy(userDateTrunc)
      .orderBy(userDateTrunc),
    db
      .select({
        date: dateTrunc,
        total: sum(platformOrder.totalCents),
      })
      .from(platformOrder)
      .where(gte(platformOrder.createdAt, startDate))
      .groupBy(dateTrunc)
      .orderBy(dateTrunc),
    db
      .select({
        date: dateTrunc,
        count: count(),
      })
      .from(platformOrder)
      .where(gte(platformOrder.createdAt, startDate))
      .groupBy(dateTrunc)
      .orderBy(dateTrunc),
    db
      .select({
        date: disputeDateTrunc,
        count: count(),
      })
      .from(dispute)
      .where(gte(dispute.createdAt, startDate))
      .groupBy(disputeDateTrunc)
      .orderBy(disputeDateTrunc),
  ])

  const signupMap = new Map(signupRows.map((r) => [r.date, Number(r.count ?? 0)]))
  const revenueMap = new Map(revenueRows.map((r) => [r.date, Math.round(Number(r.total ?? 0))]))
  const orderMap = new Map(orderRows.map((r) => [r.date, Number(r.count ?? 0)]))
  const disputeMap = new Map(disputeRows.map((r) => [r.date, Number(r.count ?? 0)]))

  const signups: DailyTrendPoint[] = []
  const revenue: DailyTrendPoint[] = []
  const orders: DailyTrendPoint[] = []
  const disputes: DailyTrendPoint[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    signups.push({ date: iso, value: signupMap.get(iso) ?? 0 })
    revenue.push({ date: iso, value: revenueMap.get(iso) ?? 0 })
    orders.push({ date: iso, value: orderMap.get(iso) ?? 0 })
    disputes.push({ date: iso, value: disputeMap.get(iso) ?? 0 })
  }

  return { signups, revenue, orders, disputes }
}

/* -------------------------------------------------------------------------- */
/*                               Recent Audit Log                             */
/* -------------------------------------------------------------------------- */

export interface RecentAuditEntry {
  id: string
  actorName: string
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: Date
}

/**
 * Returns the most recent audit log entries.
 */
export async function getRecentAuditEntriesQuery(limit: number): Promise<RecentAuditEntry[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      actorName: auditLog.actorName,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)

  return rows
}
