import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { shippingLabel, shop } from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import { getCarrierTrackingUrl } from '../shipping'
import { calculatePackageFromItems } from '../shipping-estimate'
import { getShopOrderQuery, markShopOrderShippedQuery } from './operations.server'
import type { ShopOrderDetail, ShippingLabelDetail } from './types'

export interface CreateLabelInput {
  shopOrderId: string
}

export async function createShippingLabelForOrderQuery(
  shopOrderId: string,
): Promise<ShippingLabelDetail> {
  const order = await getShopOrderQuery(shopOrderId)
  if (!order) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [shopRecord] = await db.select().from(shop).where(eq(shop.id, order.shopId)).limit(1)

  if (!shopRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const origin = shopRecord.shippingOrigin as {
    street: string
    city: string
    postalCode: string
    country: string
  } | null

  if (!origin) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Shop shipping origin address is not configured',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const pkg = calculatePackageFromItems(order.items)

  try {
    const provider = getShippingProvider()
    const label = await provider.createLabel({
      origin,
      destination: order.shippingAddress,
      package: pkg,
      carrierService:
        order.shippingRateId ?? (order.shippingMethod === 'express' ? 'express' : 'standard'),
      reference: shopOrderId,
      pickupPoint: order.shippingAddress.pickupPoint,
      declaredValueCents: order.subtotalCents + order.shippingCostCents,
    })

    const [record] = await db
      .insert(shippingLabel)
      .values({
        shopOrderId,
        carrier: label.carrier,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        externalParcelId: label.externalParcelId ?? null,
      })
      .returning()

    return {
      id: record.id,
      carrier: record.carrier,
      trackingNumber: record.trackingNumber,
      labelUrl: record.labelUrl,
      createdAt: record.createdAt,
    }
  } catch (error) {
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message:
          error instanceof Error
            ? error.message
            : 'Shipping label generation failed. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export async function markShopOrderShippedWithLabelQuery(
  shopOrderId: string,
): Promise<ShopOrderDetail> {
  // Provider I/O happens before the status transaction so a network call never
  // extends the database lock. A provider failure therefore leaves status intact.
  const label = await createShippingLabelForOrderQuery(shopOrderId)
  const trackingUrl = getCarrierTrackingUrl(label.carrier, label.trackingNumber)

  return markShopOrderShippedQuery(shopOrderId, {
    trackingNumber: label.trackingNumber,
    trackingUrl: trackingUrl || label.labelUrl,
  })
}
