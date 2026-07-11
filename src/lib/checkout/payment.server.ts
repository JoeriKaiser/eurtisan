import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { platformOrder } from '#/db/schema'
import { SUPPORTED_CURRENCY } from '../currency'
import { getBaseUrl } from '../env.server'
import { logger } from '../logger.server'
import type { PaymentProvider } from '../payment-provider'
import type { RetryPaymentResult } from './types'

function getPaymentUrls(platformOrderId: string): { redirectUrl: string; webhookUrl: string } {
  const baseUrl = getBaseUrl()
  return {
    redirectUrl: `${baseUrl}/orders/${platformOrderId}/success`,
    webhookUrl: `${baseUrl}/api/webhooks/mollie`,
  }
}

async function createAndPersistPayment(
  platformOrderId: string,
  totalCents: number,
  buyerCountry: string | undefined,
  paymentProvider: PaymentProvider,
): Promise<string> {
  const { redirectUrl, webhookUrl } = getPaymentUrls(platformOrderId)
  const payment = await paymentProvider.createPayment(
    totalCents,
    SUPPORTED_CURRENCY,
    `Eurtisan order ${platformOrderId}`,
    redirectUrl,
    webhookUrl,
    buyerCountry,
  )

  await db
    .update(platformOrder)
    .set({ molliePaymentId: payment.paymentId, updatedAt: new Date() })
    .where(eq(platformOrder.id, platformOrderId))

  return payment.checkoutUrl
}

/**
 * Initiate the first payment attempt after a checkout transaction has
 * committed. External calls are intentionally kept outside the transaction so
 * provider latency never holds inventory or order locks.
 */
export async function initiateCheckoutPayment(
  platformOrderId: string,
  totalCents: number,
  buyerCountry: string | undefined,
  paymentProvider: PaymentProvider,
): Promise<string> {
  try {
    return await createAndPersistPayment(platformOrderId, totalCents, buyerCountry, paymentProvider)
  } catch (error) {
    logger.error('Payment initiation failed in createCheckout', error, { platformOrderId })
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Payment could not be initiated. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/**
 * Retry payment creation for an existing platform order that is still in
 * `pending_payment` status. This preserves the existing order and inventory
 * reservation while replacing only the provider payment ID on success.
 */
export async function retryPayment(
  platformOrderId: string,
  userId: string,
  paymentProvider: PaymentProvider,
): Promise<RetryPaymentResult> {
  const [order] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (!order) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (order.userId !== userId) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (order.status !== 'pending_payment') {
    throw new Response(
      JSON.stringify({
        error: 'Conflict',
        message: 'Order is not in pending payment status',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const shippingAddress = order.shippingAddress as { country?: string } | null
  const buyerCountry = shippingAddress?.country

  try {
    const checkoutUrl = await createAndPersistPayment(
      platformOrderId,
      order.totalCents,
      buyerCountry,
      paymentProvider,
    )
    return { checkoutUrl }
  } catch {
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Payment could not be initiated. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
