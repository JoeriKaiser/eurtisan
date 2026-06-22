/**
 * Mollie chargeback webhook endpoint — POST /api/webhooks/mollie-chargeback
 *
 * Receives chargeback notifications from Mollie. Chargebacks differ from normal
 * refunds because the money is clawed back by the buyer's bank, so we must also
 * claw back any routed seller payout, issue credit notes, and restore stock.
 */
import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index'
import { molliePaymentProvider } from '#/integrations/mollie'
import { handleChargeback } from '#/lib/chargebacks.server'
import { logger } from '#/lib/logger.server'
import { webhookProcessedTotal } from '#/lib/metrics.server'
import type { PaymentProvider } from '#/lib/payment-provider'

export interface MollieChargebackWebhookPayload {
  id: string
}

export async function processMollieChargebackWebhook(
  request: Request,
  options?: {
    db?: typeof db
    paymentProvider?: PaymentProvider
  },
): Promise<Response> {
  const database = options?.db ?? db
  const provider = options?.paymentProvider ?? molliePaymentProvider

  const signature = request.headers.get('X-Mollie-Signature') ?? ''

  let rawBody: string
  let payload: MollieChargebackWebhookPayload
  try {
    rawBody = await request.text()
    const parsed = JSON.parse(rawBody) as MollieChargebackWebhookPayload
    payload = parsed
  } catch {
    return new Response(JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!payload.id || typeof payload.id !== 'string') {
    return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing payment ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let isValid: boolean
  try {
    isValid = await provider.verifyWebhook(payload, signature, rawBody)
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Malformed signature' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw error
  }

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let paymentStatus: Awaited<ReturnType<typeof provider.getPaymentStatus>>
  try {
    paymentStatus = await provider.getPaymentStatus(payload.id)
  } catch (error) {
    logger.error('Mollie chargeback webhook getPaymentStatus failed', error, {
      alert: true,
      molliePaymentId: payload.id,
    })
    return new Response(JSON.stringify({ status: 'provider_error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (paymentStatus !== 'chargeback') {
    webhookProcessedTotal.inc({ status: 'already_processed' })
    return new Response(JSON.stringify({ status: 'already_processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await handleChargeback(payload.id, { db: database })

  if (result.status === 'unknown_payment') {
    return new Response(JSON.stringify({ status: 'unknown_payment' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  webhookProcessedTotal.inc({ status: 'chargeback' })
  return new Response(JSON.stringify({ status: 'chargeback' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/webhooks/mollie-chargeback')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return processMollieChargebackWebhook(request)
      },
    },
  },
})
