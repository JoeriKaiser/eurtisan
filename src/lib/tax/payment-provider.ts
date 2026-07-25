/**
 * Payment provider abstraction for Mollie integration.
 *
 * All monetary amounts are in euro cents (integer).
 */

/** Result returned after initiating a payment. */
export interface CreatePaymentResult {
  /** Payment identifier returned by the provider (e.g. Mollie payment ID). */
  paymentId: string
  /** URL the buyer must visit to complete payment. */
  checkoutUrl: string
}

/**
 * Routing reversal for partial refunds on split payments.
 */
export interface RoutingReversal {
  /** Connected seller Mollie organization ID. */
  organizationId: string
  /** Amount to claw back from the seller, in euro cents. */
  amountCents: number
}

/**
 * Payment provider interface.
 *
 * Every payment provider (currently only Mollie) must implement these three
 * methods. The implementation is injected into checkout and dispute-resolution
 * flows so it can be swapped for a mock in development or for another provider
 * in the future.
 */
export interface PaymentProvider {
  /**
   * Initiate a payment and return a hosted checkout URL.
   */
  createPayment(
    amountCents: number,
    currency: string,
    description: string,
    redirectUrl: string,
    webhookUrl: string,
    billingCountry?: string,
    idempotencyKey?: string,
  ): Promise<CreatePaymentResult>

  /**
   * Query the status of an existing payment.
   *
   * Returns the current status as reported by the provider.
   */
  getPaymentStatus(
    paymentId: string,
  ): Promise<'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback'>

  /**
   * Query the amount of an existing payment.
   *
   * Returns the payment amount in euro cents.
   */
  getPaymentAmount(paymentId: string): Promise<number>

  /**
   * Refund a previously created payment.
   *
   * Pass `amountCents` for a partial refund; omit for a full refund.
   *
   * For split payments, pass `reverseRouting: true` for a full refund or
   * `routingReversals` for a partial refund so the platform can claw back the
   * seller's share automatically.
   */
  refundPayment(
    paymentId: string,
    amountCents?: number,
    options?: {
      reverseRouting?: boolean
      routingReversals?: RoutingReversal[]
      idempotencyKey?: string
    },
  ): Promise<void>

  /**
   * Cancel a payment that has not yet been completed.
   *
   * Useful for race conditions where an order is cancelled while the buyer's
   * payment is still pending. If the payment has already been captured, the
   * provider should throw so the caller can fall back to a refund.
   */
  cancelPayment(paymentId: string): Promise<void>
}
