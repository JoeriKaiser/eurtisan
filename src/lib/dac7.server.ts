import { and, eq, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { shopOrder } from '#/db/schema'

export interface Dac7Status {
  transactionCount: number
  grossSalesCents: number
  approachingLimit: boolean // 80% of limit: 24 sales or €1,600
  exceededLimit: boolean // 100% of limit: 30 sales or €2,000
}

/**
 * Calculates a shop's transaction count and gross sales for the specified calendar year.
 * Checks them against the EU DAC7 compliance reporting thresholds.
 */
export async function getDac7ComplianceStatus(shopId: string, year: number): Promise<Dac7Status> {
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`)
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`)

  // Aggregate transaction counts and gross sales (subtotal + shipping) for completed/delivered orders
  const [totals] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`sum(${shopOrder.subtotalCents} + ${shopOrder.shippingCostCents})`,
    })
    .from(shopOrder)
    .where(
      and(
        eq(shopOrder.shopId, shopId),
        sql`${shopOrder.status} IN ('completed', 'delivered')`,
        sql`${shopOrder.createdAt} BETWEEN ${startDate} AND ${endDate}`,
      ),
    )

  const transactionCount = Number(totals?.count ?? 0)
  const grossSalesCents = Number(totals?.revenue ?? 0)

  return {
    transactionCount,
    grossSalesCents,
    approachingLimit: transactionCount >= 24 || grossSalesCents >= 160000,
    exceededLimit: transactionCount >= 30 || grossSalesCents >= 200000,
  }
}
