import '@tanstack/react-start/server-only'

import z from 'zod'
import { db } from '#/db/index'
import { molliePaymentProvider } from '#/integrations/mollie'
import { logger } from '#/lib/logger.server'
import { mollieWebhookFailedTotal, webhookProcessedTotal } from '#/lib/metrics.server'
import type { PaymentProvider } from '#/lib/payment-provider'
import { reconcileMolliePayment } from './mollie-reconciliation.server'

const MAX_CLASSIC_WEBHOOK_BODY_BYTES = 1024

const classicMollieWebhookSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^tr_[A-Za-z0-9_-]+$/),
  })
  .strict()

/**
 * Process Mollie's classic Payments API webhook contract.
 *
 * Classic callbacks are form-encoded and contain only a payment id. They are
 * not signed. Authenticity comes from retrieving that payment through Mollie's
 * authenticated server-side API and applying only the returned provider state.
 */
export async function processMollieWebhook(
  request: Request,
  options?: {
    db?: typeof db
    paymentProvider?: PaymentProvider
  },
): Promise<Response> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/x-www-form-urlencoded') {
    return jsonResponse(415, {
      error: 'Unsupported Media Type',
      message: 'Expected application/x-www-form-urlencoded',
    })
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_CLASSIC_WEBHOOK_BODY_BYTES) {
    return jsonResponse(413, { error: 'Payload Too Large', message: 'Webhook body is too large' })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return jsonResponse(400, { error: 'Bad Request', message: 'Unable to read request body' })
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_CLASSIC_WEBHOOK_BODY_BYTES) {
    return jsonResponse(413, { error: 'Payload Too Large', message: 'Webhook body is too large' })
  }

  const form = new URLSearchParams(rawBody)
  if (form.getAll('id').length !== 1) {
    return jsonResponse(400, { error: 'Bad Request', message: 'Missing or duplicate payment ID' })
  }

  const parsed = classicMollieWebhookSchema.safeParse(Object.fromEntries(form.entries()))
  if (!parsed.success) {
    return jsonResponse(400, { error: 'Bad Request', message: 'Invalid payment ID payload' })
  }

  try {
    const result = await reconcileMolliePayment(parsed.data.id, {
      db: options?.db ?? db,
      paymentProvider: options?.paymentProvider ?? molliePaymentProvider,
    })
    webhookProcessedTotal.inc({ status: result.status })
    return jsonResponse(200, { status: result.status })
  } catch (error) {
    mollieWebhookFailedTotal.inc({ reason: 'processing_error' })
    logger.error('Mollie webhook processing failed', error, {
      alert: true,
      molliePaymentId: parsed.data.id,
    })
    return jsonResponse(503, {
      error: 'Service Unavailable',
      status: 'provider_or_processing_error',
    })
  }
}

function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
