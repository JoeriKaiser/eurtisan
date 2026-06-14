import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { shippingLabel, shopOrder } from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import { logger } from './logger.server'
import { markShopOrderDeliveredQuery } from './shop-orders.server'

export interface SendcloudReconciliationResult {
  checked: number
  updated: number
  errors: number
}

/**
 * Reconcile shipped orders against the Sendcloud API.
 *
 * Queries for shop orders that are still in `shipped` status but have a
 * shipping label older than the configured grace period, then polls Sendcloud
 * for the latest tracking status. If Sendcloud reports the parcel as delivered,
 * the order is marked as delivered.
 *
 * This is a safety net for missed webhooks.
 */
export async function reconcileSendcloudShipments(options?: {
  db?: typeof db
  graceHours?: number
}): Promise<SendcloudReconciliationResult> {
  const database = options?.db ?? db
  const graceHours = options?.graceHours ?? 1
  const minLabelAge = new Date(Date.now() - graceHours * 60 * 60 * 1000)

  const pending = await database
    .select({
      shopOrderId: shopOrder.id,
      trackingNumber: shippingLabel.trackingNumber,
      labelId: shippingLabel.id,
    })
    .from(shopOrder)
    .innerJoin(shippingLabel, eq(shippingLabel.shopOrderId, shopOrder.id))
    .where(
      and(
        eq(shopOrder.status, 'shipped'),
        isNull(shopOrder.deliveredAt),
        lt(shippingLabel.createdAt, minLabelAge),
        sql`${shippingLabel.trackingNumber} IS NOT NULL`,
      ),
    )

  const result: SendcloudReconciliationResult = { checked: pending.length, updated: 0, errors: 0 }

  if (pending.length === 0) {
    return result
  }

  const provider = getShippingProvider()

  for (const row of pending) {
    if (!row.trackingNumber) continue

    try {
      const info = await provider.trackShipment(row.trackingNumber)

      if (info.status === 'delivered') {
        await markShopOrderDeliveredQuery(row.shopOrderId)
        result.updated++
      }
    } catch (err) {
      result.errors++
      logger.error('Sendcloud reconciliation: failed to track shipment', err, {
        shopOrderId: row.shopOrderId,
        trackingNumber: row.trackingNumber,
        labelId: row.labelId,
      })
    }
  }

  return result
}
