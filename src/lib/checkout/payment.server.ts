import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '#/db/index'
import { inventoryReservation, paymentAttempt, platformOrder } from '#/db/schema'
import { SUPPORTED_CURRENCY } from '../currency'
import { decryptJsonb, encrypt } from '../encryption.server'
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

class PaymentAlreadyCapturedError extends Error {
  constructor(readonly paymentId: string) {
    super(`Payment already captured: ${paymentId}`)
    this.name = 'PaymentAlreadyCapturedError'
  }
}

async function retirePreviousProviderPayment(
  platformOrderId: string,
  previousProviderPaymentId: string,
  paymentProvider: PaymentProvider,
): Promise<void> {
  let status: Awaited<ReturnType<PaymentProvider['getPaymentStatus']>>
  try {
    status = await paymentProvider.getPaymentStatus(previousProviderPaymentId)
  } catch {
    status = 'failed'
  }

  if (status === 'paid' || status === 'chargeback') {
    throw new PaymentAlreadyCapturedError(previousProviderPaymentId)
  }

  if (status === 'pending') {
    try {
      await paymentProvider.cancelPayment(previousProviderPaymentId)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('already been captured')) {
        throw new PaymentAlreadyCapturedError(previousProviderPaymentId)
      }
      throw error
    }
  }

  await db
    .update(paymentAttempt)
    .set({ status: 'superseded', updatedAt: new Date() })
    .where(
      and(
        eq(paymentAttempt.platformOrderId, platformOrderId),
        eq(paymentAttempt.providerPaymentId, previousProviderPaymentId),
      ),
    )
}

async function createAndPersistPayment(
  platformOrderId: string,
  totalCents: number,
  buyerCountry: string | undefined,
  paymentProvider: PaymentProvider,
): Promise<string> {
  const { redirectUrl, webhookUrl } = getPaymentUrls(platformOrderId)
  const [order] = await db
    .select({
      orderNumber: platformOrder.orderNumber,
      molliePaymentId: platformOrder.molliePaymentId,
    })
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  const [inFlightAttempt] = await db
    .select()
    .from(paymentAttempt)
    .where(
      and(
        eq(paymentAttempt.platformOrderId, platformOrderId),
        eq(paymentAttempt.status, 'initiating'),
      ),
    )
    .orderBy(desc(paymentAttempt.createdAt))
    .limit(1)

  if (!inFlightAttempt) {
    const [completedAttempt] = await db
      .select()
      .from(paymentAttempt)
      .where(
        and(
          eq(paymentAttempt.platformOrderId, platformOrderId),
          eq(paymentAttempt.status, 'completed'),
        ),
      )
      .orderBy(desc(paymentAttempt.createdAt))
      .limit(1)

    const previousId = completedAttempt?.providerPaymentId ?? order?.molliePaymentId ?? null
    if (previousId) {
      await retirePreviousProviderPayment(platformOrderId, previousId, paymentProvider)
    }
  }

  const idempotencyKey = inFlightAttempt?.idempotencyKey ?? crypto.randomUUID()
  const attemptId = inFlightAttempt?.id
    ? inFlightAttempt.id
    : (
        await db
          .insert(paymentAttempt)
          .values({ platformOrderId, idempotencyKey })
          .returning({ id: paymentAttempt.id })
      )[0].id

  const payment = await paymentProvider.createPayment(
    totalCents,
    SUPPORTED_CURRENCY,
    `Eurtisan order ${order?.orderNumber ?? platformOrderId}`,
    redirectUrl,
    webhookUrl,
    buyerCountry,
    idempotencyKey,
  )

  await db.transaction(async (tx) => {
    await tx
      .update(paymentAttempt)
      .set({
        status: 'completed',
        providerPaymentId: payment.paymentId,
        checkoutUrl: encrypt(payment.checkoutUrl),
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempt.id, attemptId))
    await tx
      .update(platformOrder)
      .set({ molliePaymentId: payment.paymentId, updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))
  })

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
): Promise<string | null> {
  try {
    return await createAndPersistPayment(platformOrderId, totalCents, buyerCountry, paymentProvider)
  } catch (error) {
    logger.error('Payment initiation failed in createCheckout', error, {
      alert: true,
      platformOrderId,
    })
    return null
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
        code: 'PAYMENT_NOT_RETRYABLE',
        message: 'This payment can no longer be retried.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [activeReservation] = await db
    .select({ expiresAt: inventoryReservation.expiresAt })
    .from(inventoryReservation)
    .where(
      and(
        eq(inventoryReservation.platformOrderId, platformOrderId),
        gt(inventoryReservation.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!activeReservation) {
    throw new Response(
      JSON.stringify({
        error: 'Conflict',
        code: 'RESERVATION_EXPIRED',
        message: 'The inventory reservation has expired. Rebuild your cart to continue.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const shippingAddress = decryptJsonb<{ country?: string }>(order.shippingAddress)
  const buyerCountry = shippingAddress?.country

  try {
    const checkoutUrl = await createAndPersistPayment(
      platformOrderId,
      order.totalCents,
      buyerCountry,
      paymentProvider,
    )
    return { checkoutUrl }
  } catch (error) {
    if (error instanceof PaymentAlreadyCapturedError) {
      try {
        const { reconcileMolliePayment } = await import('../payments/mollie-reconciliation.server')
        await reconcileMolliePayment(error.paymentId, { paymentProvider })
      } catch (reconcileError) {
        logger.error('Failed to reconcile captured payment during retry', reconcileError, {
          alert: true,
          platformOrderId,
          molliePaymentId: error.paymentId,
        })
      }
      throw new Response(
        JSON.stringify({
          error: 'Conflict',
          code: 'PAYMENT_ALREADY_CAPTURED',
          message: 'This order has already been paid.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    throw new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Payment could not be initiated. Please try again.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
