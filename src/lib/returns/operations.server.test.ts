import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { orderItem, platformOrder, returnRequest, shopOrder } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { flushBackgroundWorkForTests } from '../background-work.server'
import { createPaidOrder } from '#/test/scenarios'
import {
  createReturnRequestQuery,
  manageReturnRequestQuery,
  updateReturnShipmentQuery,
} from './operations.server'

async function createDeliveredOrder() {
  const scenario = await createPaidOrder()
  const deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  await db
    .update(shopOrder)
    .set({
      status: 'delivered',
      deliveredAt,
      standardShippingCostCents: 500,
    })
    .where(eq(shopOrder.id, scenario.shopOrder.id))
  return { ...scenario, deliveredAt }
}

describe('return request operations', () => {
  beforeEach(clearTestTables)
  afterEach(async () => {
    // Invariant: every async side effect triggered by a test must settle before
    // the next beforeEach(clearTestTables). Request paths exercised here detach
    // post-commit work via `scheduleBackgroundWork`, which tracks chains under
    // VITEST precisely so they can be awaited. A chain left running overlaps the
    // next test's cleanup/fixtures: its backend interleaves with the DELETEs
    // (TRUNCATE historically) clearing parents, producing FK "not present"
    // failures on re-seeded ids (e.g. shop-1) and cross-backend lock cycles
    // (child-insert FK KEY SHARE vs cleanup row/table locks). No-op when
    // nothing was scheduled.
    await flushBackgroundWorkForTests()
    await clearTestTables()
  })

  it('creates an authorized withdrawal with buyer-funded shipping and a full refund estimate', async () => {
    const scenario = await createDeliveredOrder()
    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'withdrawal',
        reason: 'I changed my mind about this item.',
        items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
      },
      scenario.buyer.id,
    )

    expect(request.status).toBe('awaiting_shipment')
    expect(request.returnShippingPayer).toBe('buyer')
    expect(request.refundCents).toBe(1500)
    expect(request.outboundShippingRefundCents).toBe(500)
    expect(request.items).toHaveLength(1)
  })

  it('creates a seller-reviewed defective return even for an excluded product policy', async () => {
    const scenario = await createDeliveredOrder()
    await db
      .update(orderItem)
      .set({ returnPolicySnapshot: 'personalized' })
      .where(eq(orderItem.id, scenario.orderItem.id))

    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'defective',
        reason: 'The personalized item arrived cracked.',
        items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
      },
      scenario.buyer.id,
    )

    expect(request.status).toBe('requested')
    expect(request.returnShippingPayer).toBe('seller')
  })

  it('rejects duplicate quantities that are already in another return request', async () => {
    const scenario = await createDeliveredOrder()
    const input = {
      shopOrderId: scenario.shopOrder.id,
      type: 'withdrawal' as const,
      reason: 'I changed my mind about this item.',
      items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
    }
    await createReturnRequestQuery(input, scenario.buyer.id)

    await expect(createReturnRequestQuery(input, scenario.buyer.id)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('records buyer-provided tracking for an authorized withdrawal', async () => {
    const scenario = await createDeliveredOrder()
    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'withdrawal',
        reason: 'I changed my mind about this item.',
        items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
      },
      scenario.buyer.id,
    )

    const updated = await updateReturnShipmentQuery(
      { returnRequestId: request.id, carrier: 'PostNL', trackingNumber: '3SRETURN123' },
      scenario.buyer.id,
    )
    expect(updated.status).toBe('in_transit')
    expect(updated.trackingNumber).toBe('3SRETURN123')
  })

  it('lets the owning seller mark a shipped return as received', async () => {
    const scenario = await createDeliveredOrder()
    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'withdrawal',
        reason: 'I changed my mind about this item.',
        items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
      },
      scenario.buyer.id,
    )
    await updateReturnShipmentQuery(
      { returnRequestId: request.id, carrier: 'PostNL', trackingNumber: '3SRETURN123' },
      scenario.buyer.id,
    )

    const updated = await manageReturnRequestQuery(
      { returnRequestId: request.id, action: 'mark_received' },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )
    expect(updated.status).toBe('received')
  })

  it('retries a failed provider refund idempotently from refund_pending', async () => {
    const scenario = await createDeliveredOrder()
    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'bad' })
      .where(eq(platformOrder.id, scenario.platformOrder.id))
    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'withdrawal',
        reason: 'I changed my mind about this item.',
        items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
      },
      scenario.buyer.id,
    )
    await updateReturnShipmentQuery(
      { returnRequestId: request.id, carrier: 'PostNL', trackingNumber: 'TRACK-REFUND' },
      scenario.buyer.id,
    )
    await manageReturnRequestQuery(
      { returnRequestId: request.id, action: 'mark_received' },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )

    await expect(
      manageReturnRequestQuery(
        { returnRequestId: request.id, action: 'refund' },
        { userId: scenario.shop.ownerId, role: 'creator' },
      ),
    ).rejects.toMatchObject({ status: 502 })
    const [pending] = await db
      .select({ status: returnRequest.status })
      .from(returnRequest)
      .where(eq(returnRequest.id, request.id))
    expect(pending?.status).toBe('refund_pending')

    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'tr_mock_return_refund' })
      .where(eq(platformOrder.id, scenario.platformOrder.id))
    const refunded = await manageReturnRequestQuery(
      { returnRequestId: request.id, action: 'refund' },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )
    expect(refunded.status).toBe('refunded')
  })
})
