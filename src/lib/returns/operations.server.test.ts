import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  orderItem,
  platformOrder,
  product,
  returnRequest,
  returnRequestItem,
  shopOrder,
} from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createProduct } from '#/test/factories'
import { createPaidOrder } from '#/test/scenarios'
import {
  createReturnRequestQuery,
  getReturnRequestQuery,
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
  afterEach(clearTestTables)

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

  it('statutory withdrawal cannot be rejected by the seller', async () => {
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

    try {
      await manageReturnRequestQuery(
        {
          returnRequestId: request.id,
          action: 'reject',
          reason: 'Seller refuses withdrawal',
        },
        { userId: scenario.shop.ownerId, role: 'creator' },
      )
      expect.unreachable('Should have thrown')
    } catch (err: unknown) {
      if (err instanceof Response) {
        expect(err.status).toBe(400)
        const body = await err.json()
        expect(body.error).toBe('WITHDRAWAL_CANNOT_BE_REJECTED')
        expect(body.message).toBe(
          'Statutory withdrawal requests for eligible goods cannot be rejected by the seller',
        )
      } else {
        throw err
      }
    }
  })

  it('defective return can be rejected with reason, but fails without reason', async () => {
    const scenario = await createDeliveredOrder()
    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'defective',
        reason: 'The item stopped working after one day.',
        items: [{ orderItemId: scenario.orderItem.id, quantity: 1 }],
      },
      scenario.buyer.id,
    )

    try {
      await manageReturnRequestQuery(
        {
          returnRequestId: request.id,
          action: 'reject',
        },
        { userId: scenario.shop.ownerId, role: 'creator' },
      )
      expect.unreachable('Should have thrown')
    } catch (err: unknown) {
      if (err instanceof Response) {
        expect(err.status).toBe(400)
        const body = await err.json()
        expect(body.error).toBe('RETURN_REASON_REQUIRED')
      } else {
        throw err
      }
    }

    const rejected = await manageReturnRequestQuery(
      {
        returnRequestId: request.id,
        action: 'reject',
        reason: 'Customer dropped the product into water causing water damage',
      },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )
    expect(rejected.status).toBe('rejected')
    expect(rejected.rejectionReason).toBe(
      'Customer dropped the product into water causing water damage',
    )
  })

  it('condition deductions execute net refund, reverse net payout, and update fields', async () => {
    const scenario = await createDeliveredOrder()
    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'tr_mock_diminished_refund' })
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

    expect(request.refundCents).toBe(1500)
    expect(request.outboundShippingRefundCents).toBe(500)
    expect(request.netRefundCents).toBe(1500)
    expect(request.diminishedValueCents).toBe(0)

    await updateReturnShipmentQuery(
      { returnRequestId: request.id, carrier: 'PostNL', trackingNumber: '3SDIMINISHED' },
      scenario.buyer.id,
    )
    await manageReturnRequestQuery(
      { returnRequestId: request.id, action: 'mark_received' },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )

    try {
      await manageReturnRequestQuery(
        {
          returnRequestId: request.id,
          action: 'refund',
          diminishedValueCents: 1100,
          diminishedValueReason: 'Excess deduction',
          diminishedValueCategory: 'worn_washed',
          diminishedValueEvidenceUrls: ['https://example.com/photo.jpg'],
        },
        { userId: scenario.shop.ownerId, role: 'creator' },
      )
      expect.unreachable('Should have thrown bounds error')
    } catch (err: unknown) {
      if (err instanceof Response) {
        expect(err.status).toBe(400)
        const body = await err.json()
        expect(body.error).toBe('DIMINISHED_VALUE_EXCEEDS_BOUNDS')
      } else {
        throw err
      }
    }

    try {
      await manageReturnRequestQuery(
        {
          returnRequestId: request.id,
          action: 'refund',
          diminishedValueCents: 300,
        },
        { userId: scenario.shop.ownerId, role: 'creator' },
      )
      expect.unreachable('Should have thrown evidence error')
    } catch (err: unknown) {
      if (err instanceof Response) {
        expect(err.status).toBe(400)
        const body = await err.json()
        expect(body.error).toBe('DIMINISHED_VALUE_EVIDENCE_REQUIRED')
      } else {
        throw err
      }
    }

    const refunded = await manageReturnRequestQuery(
      {
        returnRequestId: request.id,
        action: 'refund',
        diminishedValueCents: 300,
        diminishedValueReason: 'Garment arrived worn with tags removed',
        diminishedValueCategory: 'worn_washed',
        diminishedValueEvidenceUrls: ['https://example.com/worn-photo.jpg'],
      },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )

    expect(refunded.status).toBe('refunded')
    expect(refunded.diminishedValueCents).toBe(300)
    expect(refunded.netRefundCents).toBe(1200)
    expect(refunded.diminishedValueReason).toBe('Garment arrived worn with tags removed')
    expect(refunded.diminishedValueCategory).toBe('worn_washed')
    expect(refunded.diminishedValueEvidenceUrls).toEqual(['https://example.com/worn-photo.jpg'])

    const [orderCheck] = await db
      .select({ refundedCents: shopOrder.refundedCents })
      .from(shopOrder)
      .where(eq(shopOrder.id, scenario.shopOrder.id))
    expect(orderCheck?.refundedCents).toBe(1200)
  })

  it('selective restocking only increments stock for items with restockItem: true', async () => {
    const scenario = await createDeliveredOrder()
    const product2 = await createProduct(scenario.shop, { priceCents: 800, stockCount: 5 })
    const [item2] = await db
      .insert(orderItem)
      .values({
        shopOrderId: scenario.shopOrder.id,
        productId: product2.id,
        productName: product2.name,
        quantity: 2,
        unitPriceCents: 800,
        totalCents: 1600,
      })
      .returning()

    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'tr_mock_selective_restock', totalCents: 3100 })
      .where(eq(platformOrder.id, scenario.platformOrder.id))
    await db
      .update(shopOrder)
      .set({ subtotalCents: 2600 })
      .where(eq(shopOrder.id, scenario.shopOrder.id))

    const request = await createReturnRequestQuery(
      {
        shopOrderId: scenario.shopOrder.id,
        type: 'withdrawal',
        reason: 'Returning both items for refund.',
        items: [
          { orderItemId: scenario.orderItem.id, quantity: 1 },
          { orderItemId: item2.id, quantity: 2 },
        ],
      },
      scenario.buyer.id,
    )

    await updateReturnShipmentQuery(
      { returnRequestId: request.id, carrier: 'PostNL', trackingNumber: '3SRESTOCK' },
      scenario.buyer.id,
    )
    await manageReturnRequestQuery(
      { returnRequestId: request.id, action: 'mark_received' },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )

    await manageReturnRequestQuery(
      {
        returnRequestId: request.id,
        action: 'refund',
        restockItems: [
          { orderItemId: scenario.orderItem.id, restock: true },
          { orderItemId: item2.id, restock: false },
        ],
      },
      { userId: scenario.shop.ownerId, role: 'creator' },
    )

    const [prod1After] = await db
      .select({ stockCount: product.stockCount })
      .from(product)
      .where(eq(product.id, scenario.product.id))
    const [prod2After] = await db
      .select({ stockCount: product.stockCount })
      .from(product)
      .where(eq(product.id, product2.id))

    expect(prod1After?.stockCount).toBe(11)
    expect(prod2After?.stockCount).toBe(5)

    const items = await db
      .select({
        orderItemId: returnRequestItem.orderItemId,
        restockItem: returnRequestItem.restockItem,
      })
      .from(returnRequestItem)
      .where(eq(returnRequestItem.returnRequestId, request.id))

    const restockMap = new Map(items.map((i) => [i.orderItemId, i.restockItem]))
    expect(restockMap.get(scenario.orderItem.id)).toBe(true)
    expect(restockMap.get(item2.id)).toBe(false)
  })

  it('tracking submission after returnDeadline + 72h throws 409 RETURN_DEADLINE_EXPIRED', async () => {
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

    const expiredDeadline = new Date(Date.now() - 73 * 3600000)
    await db
      .update(returnRequest)
      .set({ returnDeadline: expiredDeadline })
      .where(eq(returnRequest.id, request.id))

    try {
      await updateReturnShipmentQuery(
        { returnRequestId: request.id, carrier: 'PostNL', trackingNumber: '3SLATE' },
        scenario.buyer.id,
      )
      expect.unreachable('Should have thrown expired deadline error')
    } catch (err: unknown) {
      if (err instanceof Response) {
        expect(err.status).toBe(409)
        const body = await err.json()
        expect(body.error).toBe('RETURN_DEADLINE_EXPIRED')
        expect(body.message).toBe('Return shipping deadline has expired')
      } else {
        throw err
      }
    }
  })

  it('lazily expires status to closed in getReturnRequestQuery when awaiting_shipment exceeds returnDeadline + 7 days', async () => {
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

    const pastDeadline = new Date(Date.now() - 8 * 86400000)
    await db
      .update(returnRequest)
      .set({ returnDeadline: pastDeadline })
      .where(eq(returnRequest.id, request.id))

    const loaded = await getReturnRequestQuery(request.id, scenario.buyer.id, 'customer')
    expect(loaded?.status).toBe('closed')

    const [dbRow] = await db
      .select({ status: returnRequest.status })
      .from(returnRequest)
      .where(eq(returnRequest.id, request.id))
    expect(dbRow?.status).toBe('closed')
  })
})
