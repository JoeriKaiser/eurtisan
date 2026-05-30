/**
 * Mollie webhook endpoint — POST /api/webhooks/mollie
 *
 * Receives payment status updates from Mollie. Never trusts the client-side
 * redirect; order status is updated exclusively through this webhook.
 *
 * Idempotency: if the platform order has already been processed (status is no
 * longer `pending_payment`), the webhook is a no-op.
 */
import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { platformOrder, shopOrder } from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import { releaseStockInTx } from '#/lib/inventory.server'
import { logOrderPaid } from '#/lib/order-logger'
import type { PaymentProvider } from '#/lib/payment-provider'

/** Expected webhook payload shape from Mollie. */
export interface MollieWebhookPayload {
  id: string
}

/**
 * Process an incoming Mollie webhook request.
 *
 * Extracted for testability. The route handler delegates to this function so
 * tests can inject a mock database and payment provider.
 */
export async function processMollieWebhook(
  request: Request,
  options?: {
    db?: typeof db
    paymentProvider?: PaymentProvider
  },
): Promise<Response> {
  const database = options?.db ?? db
  const provider = options?.paymentProvider ?? molliePaymentProvider

  // 1. Read the signature header
  const signature = request.headers.get('X-Mollie-Signature') ?? ''

  // 2. Read raw body for HMAC verification, then parse JSON
  let rawBody: string
  let payload: MollieWebhookPayload
  try {
    rawBody = await request.text()

    try {
      const parsed = JSON.parse(rawBody) as MollieWebhookPayload
      payload = parsed
    } catch {
      return new Response(JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
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

  // 3. Verify the webhook signature (mandatory security requirement)
  const isValid = await provider.verifyWebhook(payload, signature, rawBody)

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 4. Find the platform order by Mollie payment ID
  const [order] = await database
    .select({
      id: platformOrder.id,
      status: platformOrder.status,
      userId: platformOrder.userId,
    })
    .from(platformOrder)
    .where(eq(platformOrder.molliePaymentId, payload.id))
    .limit(1)

  if (!order) {
    // Unknown payment ID — could be from another environment; respond 200
    // to stop Mollie from retrying
    return new Response(JSON.stringify({ status: 'unknown_payment' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 5. Idempotency: skip if already in a terminal state
  if (order.status !== 'pending_payment') {
    return new Response(JSON.stringify({ status: 'already_processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 6. Query the actual payment status from the provider
  const paymentStatus = await provider.getPaymentStatus(payload.id)

  if (paymentStatus === 'paid') {
    let totalCents = 0
    const response = await database.transaction(async (tx) => {
      // Re-fetch and lock the platform order row to prevent race conditions
      const [lockedOrder] = await tx
        .select({
          id: platformOrder.id,
          status: platformOrder.status,
        })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .for('update')
        .limit(1)

      if (!lockedOrder || lockedOrder.status !== 'pending_payment') {
        return new Response(JSON.stringify({ status: 'already_processed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const [platformOrderRecord] = await tx
        .update(platformOrder)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(eq(platformOrder.id, order.id))
        .returning()

      if (platformOrderRecord) {
        totalCents = platformOrderRecord.totalCents
      }

      // Sequential within transaction: invoice creation depends on order being marked paid.
      await tx
        .update(shopOrder)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(eq(shopOrder.platformOrderId, order.id))

      const { createInvoicesForPlatformOrder } = await import('#/lib/invoices.server')
      await createInvoicesForPlatformOrder(order.id, tx)

      return null
    })

    if (response instanceof Response) {
      return response
    }

    logOrderPaid({ platformOrderId: order.id, totalCents, paymentStatus: 'paid' })

    return new Response(JSON.stringify({ status: 'processed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (paymentStatus === 'expired' || paymentStatus === 'failed' || paymentStatus === 'cancelled') {
    const response = await database.transaction(async (tx) => {
      // Re-fetch and lock the platform order row to prevent race conditions
      const [lockedOrder] = await tx
        .select({
          id: platformOrder.id,
          status: platformOrder.status,
        })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .for('update')
        .limit(1)

      if (!lockedOrder || lockedOrder.status !== 'pending_payment') {
        return new Response(JSON.stringify({ status: 'already_processed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Sequential within transaction to ensure consistent read-write ordering.
      await tx
        .update(platformOrder)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(platformOrder.id, order.id))

      await tx
        .update(shopOrder)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(shopOrder.platformOrderId, order.id))

      await releaseStockInTx(tx, order.id)

      return null
    })

    if (response instanceof Response) {
      return response
    }

    return new Response(JSON.stringify({ status: 'cancelled' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Payment is still pending — acknowledge the webhook and wait for the next update
  return new Response(JSON.stringify({ status: 'pending' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/webhooks/mollie')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return processMollieWebhook(request)
      },
    },
  },
})
