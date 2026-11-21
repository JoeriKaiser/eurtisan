import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { shippingLabel, shop, user } from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import { SendcloudError } from '#/integrations/shipping/sendcloud-provider'
import { decryptJsonb } from '../encryption.server'
import { logger } from '../logger.server'
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

  const [ownerRecord] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, shopRecord.ownerId))
    .limit(1)

  // Encrypted at rest. Read raw, this is a base64 string: the `!origin` guard
  // below would pass and the carrier would receive a label request whose sender
  // street, city, postcode, and country are all `undefined`.
  const origin = decryptJsonb<{
    street?: string
    city?: string
    postalCode?: string
    country?: string
  } | null>(shopRecord.shippingOrigin)

  if (!origin) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Shop shipping origin address is not configured',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (
    !origin.street?.trim() ||
    !origin.city?.trim() ||
    !origin.postalCode?.trim() ||
    !origin.country?.trim()
  ) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message:
          'Shop shipping origin address is incomplete. Add street, city, postal code, and country in Shop Settings before generating a label.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const pkg = calculatePackageFromItems(order.items)

  try {
    const provider = getShippingProvider()
    const label = await provider.createLabel({
      origin: {
        name: ownerRecord?.name?.trim() || shopRecord.name,
        company: shopRecord.name,
        street: origin.street.trim(),
        city: origin.city.trim(),
        postalCode: origin.postalCode.trim(),
        country: origin.country.trim(),
        email: ownerRecord?.email?.trim() || undefined,
      },
      destination: {
        name: order.shippingAddress.name,
        street: order.shippingAddress.street,
        addressLine2: order.shippingAddress.addressLine2,
        city: order.shippingAddress.city,
        postalCode: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
        email: order.shippingAddress.contactEmail || order.buyer.email || undefined,
        phone: order.shippingAddress.phone,
      },
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
    logger.error('createShippingLabelForOrderQuery: failed to generate shipping label', error, {
      shopOrderId,
      shopId: order.shopId,
      sendcloudMessage: error instanceof SendcloudError ? error.sendcloudMessage : undefined,
      statusCode: error instanceof SendcloudError ? error.statusCode : undefined,
    })
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
