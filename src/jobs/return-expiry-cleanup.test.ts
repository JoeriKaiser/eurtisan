/**
 * Tests for return expiry cleanup job.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { returnRequest } from '#/db/schema'
import type { ReturnRequestStatus } from '#/lib/returns/types'
import { closeExpiredReturnRequestsQuery } from '#/lib/returns/operations.server'
import { clearTestTables } from '#/test/cleanup'
import { createPaidOrder } from '#/test/scenarios'

import { tick } from './return-expiry-cleanup'

async function createReturnRecord(status: ReturnRequestStatus, returnDeadline: Date) {
  const scenario = await createPaidOrder()
  const [request] = await db
    .insert(returnRequest)
    .values({
      shopOrderId: scenario.shopOrder.id,
      buyerUserId: scenario.buyer.id,
      type: 'withdrawal',
      status,
      reason: 'Expired return test request reason here',
      returnShippingPayer: 'buyer',
      policyVersion: 'eu-baseline-2026-01',
      requestDeadline: new Date(),
      returnDeadline,
      refundCents: 1000,
      outboundShippingRefundCents: 500,
      diminishedValueCents: 0,
      netRefundCents: 1000,
    })
    .returning()
  return { ...scenario, request }
}

describe('return-expiry-cleanup job', () => {
  beforeEach(clearTestTables)

  it('closes return requests in requested, authorized, or awaiting_shipment with returnDeadline < now - 7 days', async () => {
    const expiredDeadline = new Date(Date.now() - 8 * 86400000)

    await createReturnRecord('requested', expiredDeadline)
    await createReturnRecord('authorized', expiredDeadline)
    await createReturnRecord('awaiting_shipment', expiredDeadline)

    const result = await tick()
    expect(result.closedCount).toBe(3)

    const rows = await db
      .select({ id: returnRequest.id, status: returnRequest.status })
      .from(returnRequest)
    for (const row of rows) {
      expect(row.status).toBe('closed')
    }
  })

  it('does not close return requests where returnDeadline is within 7 days', async () => {
    const activeDeadline = new Date(Date.now() - 5 * 86400000)
    const futureDeadline = new Date(Date.now() + 5 * 86400000)

    await createReturnRecord('requested', activeDeadline)
    await createReturnRecord('authorized', futureDeadline)
    await createReturnRecord('awaiting_shipment', activeDeadline)

    const result = await tick()
    expect(result.closedCount).toBe(0)

    const rows = await db
      .select({ id: returnRequest.id, status: returnRequest.status })
      .from(returnRequest)
    expect(rows.some((r) => r.status === 'closed')).toBe(false)
  })

  it('does not close return requests in other statuses even if deadline expired', async () => {
    const expiredDeadline = new Date(Date.now() - 10 * 86400000)

    const inTransit = await createReturnRecord('in_transit', expiredDeadline)
    const received = await createReturnRecord('received', expiredDeadline)
    const refunded = await createReturnRecord('refunded', expiredDeadline)
    const rejected = await createReturnRecord('rejected', expiredDeadline)

    const result = await tick()
    expect(result.closedCount).toBe(0)

    const rows = await db
      .select({ id: returnRequest.id, status: returnRequest.status })
      .from(returnRequest)
    const statusMap = new Map(rows.map((r) => [r.id, r.status]))
    expect(statusMap.get(inTransit.request.id)).toBe('in_transit')
    expect(statusMap.get(received.request.id)).toBe('received')
    expect(statusMap.get(refunded.request.id)).toBe('refunded')
    expect(statusMap.get(rejected.request.id)).toBe('rejected')
  })

  it('is idempotent on subsequent runs', async () => {
    const expiredDeadline = new Date(Date.now() - 8 * 86400000)
    await createReturnRecord('awaiting_shipment', expiredDeadline)

    const firstRun = await tick()
    expect(firstRun.closedCount).toBe(1)

    const secondRun = await tick()
    expect(secondRun.closedCount).toBe(0)
  })

  it('respects batch size when calling closeExpiredReturnRequestsQuery', async () => {
    const expiredDeadline = new Date(Date.now() - 8 * 86400000)
    await createReturnRecord('awaiting_shipment', expiredDeadline)
    await createReturnRecord('authorized', expiredDeadline)
    await createReturnRecord('requested', expiredDeadline)

    const closed = await closeExpiredReturnRequestsQuery(2)
    expect(closed).toBe(2)

    const remainingClosed = await closeExpiredReturnRequestsQuery(2)
    expect(remainingClosed).toBe(1)
  })
})
