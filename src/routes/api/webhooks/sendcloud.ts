/**
 * Sendcloud webhook endpoint — POST /api/webhooks/sendcloud
 *
 * Receives parcel status updates from Sendcloud. Signature verification is
 * mandatory. Order status transitions are driven exclusively by this webhook
 * (and the fallback polling in orders.server.ts).
 */

import { createFileRoute } from '@tanstack/react-router'
import { eq, or } from 'drizzle-orm'
import { db } from '#/db/index'
import { sendcloudWebhookEvent, shippingLabel, shopOrder } from '#/db/schema'
import { SendcloudProvider } from '#/integrations/shipping/sendcloud-provider'
import { getSendcloudWebhookSecret } from '#/lib/env.server'
import { logger } from '#/lib/logger.server'
import { sendcloudWebhookFailedTotal } from '#/lib/metrics.server'
import {
  markShopOrderDeliveredQuery,
  updateAuthoritativeTrackingStateQuery,
} from '#/lib/shop-orders.server'

/** Expected webhook payload shape from Sendcloud. */
export interface SendcloudWebhookPayload {
  action?: string
  parcel?: {
    id: number
    tracking_number: string
    status?: {
      message: string
    }
  }
}

/**
 * Process an incoming Sendcloud webhook request.
 *
 * Extracted for testability. The route handler delegates to this function so
 * tests can inject a mock database and provider.
 */
export async function processSendcloudWebhook(
  request: Request,
  options?: {
    db?: typeof db
    verifySignature?: (payload: string, signature: string, secret: string) => Promise<boolean>
    secret?: string
  },
): Promise<Response> {
  const database = options?.db ?? db
  const secret = options?.secret ?? getSendcloudWebhookSecret()

  // 1. Read raw body for signature verification, then parse JSON.
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return jsonResponse(400, 'Bad Request', 'Unable to read request body')
  }

  let payload: SendcloudWebhookPayload
  try {
    payload = JSON.parse(rawBody) as SendcloudWebhookPayload
  } catch {
    return jsonResponse(400, 'Bad Request', 'Invalid JSON body')
  }

  // 2. Persist the incoming event before processing so it can be replayed or audited.
  const signature = request.headers.get('Sendcloud-Signature') ?? ''
  const trackingNumber = payload.parcel?.tracking_number
  const parcelId = payload.parcel?.id
  const statusMessage = payload.parcel?.status?.message

  const [eventRecord] = await database
    .insert(sendcloudWebhookEvent)
    .values({
      payload: payload as Record<string, unknown>,
      signatureHeader: signature,
      trackingNumber,
      parcelId: parcelId != null ? String(parcelId) : null,
      status: statusMessage ?? null,
    })
    .returning({ id: sendcloudWebhookEvent.id })

  // 3. Verify the webhook signature (mandatory security requirement).
  if (!secret) {
    sendcloudWebhookFailedTotal.inc({ reason: 'secret_not_configured' })
    await markEventProcessed(database, eventRecord.id, 'secret_not_configured')
    logger.error('Sendcloud webhook secret is not configured')
    return jsonResponse(500, 'Internal Server Error', 'Webhook secret not configured')
  }

  const verify = options?.verifySignature ?? new SendcloudProvider().verifyWebhookSignature
  let isValid: boolean
  try {
    isValid = await verify(rawBody, signature, secret)
  } catch (err) {
    sendcloudWebhookFailedTotal.inc({ reason: 'malformed_signature' })
    await markEventProcessed(database, eventRecord.id, 'malformed_signature')
    logger.error('Sendcloud webhook signature verification failed', err)
    return jsonResponse(400, 'Bad Request', 'Malformed signature')
  }

  if (!isValid) {
    sendcloudWebhookFailedTotal.inc({ reason: 'invalid_signature' })
    await markEventProcessed(database, eventRecord.id, 'invalid_signature')
    return jsonResponse(401, 'Unauthorized', 'Invalid signature')
  }

  if (!trackingNumber || !parcelId) {
    await markEventProcessed(database, eventRecord.id, 'missing_tracking_or_parcel_id')
    return jsonResponse(400, 'Bad Request', 'Missing parcel tracking number or id')
  }

  // 4. Find the shipping label row by tracking number or Sendcloud parcel id.
  const [label] = await database
    .select({
      id: shippingLabel.id,
      shopOrderId: shippingLabel.shopOrderId,
      trackingNumber: shippingLabel.trackingNumber,
    })
    .from(shippingLabel)
    .where(
      or(
        eq(shippingLabel.trackingNumber, trackingNumber),
        eq(shippingLabel.externalParcelId, String(parcelId)),
      ),
    )
    .limit(1)

  if (!label) {
    // Unknown tracking number — could be from another environment; respond 200
    // to stop Sendcloud from retrying.
    logger.warn('Sendcloud webhook: unknown tracking number', { trackingNumber, parcelId })
    await markEventProcessed(database, eventRecord.id, 'unknown_tracking_number')
    return jsonResponse(200, 'unknown_tracking', 'Tracking number not recognized')
  }

  // 5. Update label and order status based on Sendcloud status.
  const normalizedStatus = normalizeStatus(statusMessage ?? '')

  if (normalizedStatus) {
    try {
      await updateAuthoritativeTrackingStateQuery(label.shopOrderId, {
        status: normalizedStatus,
        eventAt: new Date(),
      })
    } catch (err) {
      await markEventProcessed(database, eventRecord.id, 'tracking_update_failed')
      logger.error('Sendcloud webhook: failed to persist tracking state', err, {
        shopOrderId: label.shopOrderId,
        trackingNumber,
        parcelId,
      })
      return jsonResponse(200, 'tracking_update_failed', 'Failed to update tracking state')
    }
  }

  if (normalizedStatus === 'delivered') {
    try {
      const [order] = await database
        .select({ status: shopOrder.status })
        .from(shopOrder)
        .where(eq(shopOrder.id, label.shopOrderId))
        .limit(1)

      if (order && order.status === 'shipped') {
        await markShopOrderDeliveredQuery(label.shopOrderId)
      }
    } catch (err) {
      await markEventProcessed(database, eventRecord.id, 'delivery_update_failed')
      logger.error('Sendcloud webhook: failed to mark order delivered', err, {
        shopOrderId: label.shopOrderId,
        trackingNumber,
        parcelId,
      })
      // Return 200 so Sendcloud does not retry indefinitely; ops can reconcile.
      return jsonResponse(200, 'delivery_update_failed', 'Failed to update order status')
    }
  }

  if (normalizedStatus === 'unable_to_deliver' || normalizedStatus === 'returned_to_sender') {
    logger.warn('Sendcloud webhook: delivery problem', {
      status: statusMessage,
      shopOrderId: label.shopOrderId,
      trackingNumber,
      parcelId,
    })
  }

  await markEventProcessed(database, eventRecord.id, null)
  return jsonResponse(200, 'processed', 'Webhook processed')
}

function jsonResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ status: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function markEventProcessed(
  database: typeof db,
  eventId: string,
  error: string | null = null,
) {
  try {
    await database
      .update(sendcloudWebhookEvent)
      .set({ processedAt: new Date(), error })
      .where(eq(sendcloudWebhookEvent.id, eventId))
  } catch (err) {
    logger.error('Sendcloud webhook: failed to mark event processed', err, { eventId })
  }
}

function normalizeStatus(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('delivered')) return 'delivered'
  if (normalized.includes('returned to sender')) return 'returned_to_sender'
  if (normalized.includes('unable to deliver') || normalized.includes('delivery failed'))
    return 'unable_to_deliver'
  if (normalized.includes('out for delivery')) return 'out_for_delivery'
  return normalized
}

export const Route = createFileRoute('/api/webhooks/sendcloud')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return processSendcloudWebhook(request)
      },
    },
  },
})
