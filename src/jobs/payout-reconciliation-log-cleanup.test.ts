/**
 * Tests for payout reconciliation log cleanup.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { payoutReconciliationLog } from '#/db/schema'
import { cleanupPayoutReconciliationLog } from '#/lib/payout-reconciliation-log-cleanup.server'
import { clearTestTables } from '#/test/cleanup'
import {
  createPayout,
  createPayoutReconciliationLog,
  createPlatformOrder,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'

beforeEach(async () => {
  await clearTestTables()
})

describe('cleanupPayoutReconciliationLog', () => {
  it('deletes logs older than the retention period', async () => {
    const owner = await createUser({ role: 'creator' })
    const shop = await createShop(owner.id)
    const buyer = await createUser()
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const shopOrderRecord = await createShopOrder(platformOrderRecord, shop)
    const oldPayout = await createPayout(shop.id, {
      shopOrderId: shopOrderRecord.id,
      amountCents: 1000,
      status: 'sent',
    })
    const oldLog = await createPayoutReconciliationLog(oldPayout, {
      event: 'route_missing',
      createdAt: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000),
    })

    const result = await cleanupPayoutReconciliationLog(365, 100)
    expect(result.deleted).toBe(1)

    const remaining = await db
      .select({ id: payoutReconciliationLog.id })
      .from(payoutReconciliationLog)
    expect(remaining.map((r) => r.id)).not.toContain(oldLog.id)
  })

  it('keeps logs newer than the retention period', async () => {
    const owner = await createUser({ role: 'creator' })
    const shop = await createShop(owner.id)
    const buyer = await createUser()
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const shopOrderRecord = await createShopOrder(platformOrderRecord, shop)
    const recentPayout = await createPayout(shop.id, {
      shopOrderId: shopOrderRecord.id,
      amountCents: 1000,
      status: 'sent',
    })
    const recentLog = await createPayoutReconciliationLog(recentPayout, {
      event: 'route_missing',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })

    const result = await cleanupPayoutReconciliationLog(365, 100)
    expect(result.deleted).toBe(0)

    const remaining = await db
      .select({ id: payoutReconciliationLog.id })
      .from(payoutReconciliationLog)
    expect(remaining.map((r) => r.id)).toContain(recentLog.id)
  })

  it('keeps a log exactly at the retention boundary', async () => {
    const owner = await createUser({ role: 'creator' })
    const shop = await createShop(owner.id)
    const buyer = await createUser()
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const shopOrderRecord = await createShopOrder(platformOrderRecord, shop)
    const boundaryPayout = await createPayout(shop.id, {
      shopOrderId: shopOrderRecord.id,
      amountCents: 1000,
      status: 'sent',
    })
    const boundaryLog = await createPayoutReconciliationLog(boundaryPayout, {
      event: 'route_missing',
      // 1 second after the retention boundary so timing jitter does not flip the result.
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 + 1000),
    })

    const result = await cleanupPayoutReconciliationLog(365, 100)
    expect(result.deleted).toBe(0)

    const remaining = await db
      .select({ id: payoutReconciliationLog.id })
      .from(payoutReconciliationLog)
    expect(remaining.map((r) => r.id)).toContain(boundaryLog.id)
  })
})
