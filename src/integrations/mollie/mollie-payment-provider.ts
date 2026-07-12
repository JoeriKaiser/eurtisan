import '@tanstack/react-start/server-only'

/**
 * Mollie payment provider with real API and deterministic development modes.
 *
 * Classic Mollie webhooks contain only a payment id. Callers use this provider
 * to retrieve authoritative payment state before applying order transitions.
 */
import {
  getBaseUrl,
  getMockPaymentsEnabled,
  getMollieApiKey,
  getMollieTestMode,
} from '#/lib/env.server'
import type { CreatePaymentResult, PaymentProvider } from '#/lib/payment-provider'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Deterministic mock payment ID prefix so webhooks can locate orders. */
const MOCK_ID_PREFIX = 'tr_mock_'

let mockCounter = 0

function nextMockPaymentId(): string {
  mockCounter += 1
  // Include a short process-unique suffix so repeated app restarts against the
  // same test database do not collide on the singleton counter.
  const suffix = process.hrtime.bigint().toString(36).slice(-6)
  return `${MOCK_ID_PREFIX}${suffix}_${String(mockCounter).padStart(4, '0')}`
}

/**
 * For tests we expose the counter reset so tests are deterministic.
 */
export function resetMockPaymentCounter(): void {
  mockCounter = 0
}

// ---------------------------------------------------------------------------
// Mock status store (configurable per payment ID for testing)
// ---------------------------------------------------------------------------

const mockPaymentStatuses = new Map<
  string,
  'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback'
>()

const mockPaymentCancelable = new Map<string, boolean>()

const mockPaymentAmounts = new Map<string, number>()

/**
 * Set a mock status for a specific payment ID.
 * Used in tests to simulate different Mollie payment states.
 */
export function setMockPaymentStatus(
  paymentId: string,
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback',
): void {
  mockPaymentStatuses.set(paymentId, status)
}

/**
 * Set a mock amount (in euro cents) for a specific payment ID.
 * Used in tests to simulate amount mismatch scenarios.
 */
export function setMockPaymentAmount(paymentId: string, amountCents: number): void {
  mockPaymentAmounts.set(paymentId, amountCents)
}

/**
 * Clear all mock payment statuses.
 */
export function resetMockPaymentStatuses(): void {
  mockPaymentStatuses.clear()
}

/**
 * Configure whether a mock payment can be cancelled.
 * If not set, a payment is considered cancellable unless its status is 'paid'.
 */
export function setMockPaymentCancelable(paymentId: string, cancelable: boolean): void {
  mockPaymentCancelable.set(paymentId, cancelable)
}

/**
 * Clear all mock payment cancelability overrides.
 */
export function resetMockPaymentCancelable(): void {
  mockPaymentCancelable.clear()
}

/**
 * Clear all mock payment amounts.
 */
export function resetMockPaymentAmounts(): void {
  mockPaymentAmounts.clear()
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class MolliePaymentProvider implements PaymentProvider {
  /**
   * When true all API calls are mocked. Set to `false` once a real Mollie
   * account is provisioned and `MOLLIE_API_KEY` is available.
   */
  private readonly mockMode: boolean

  constructor(options?: { mock?: boolean }) {
    const apiKey = getMollieApiKey()
    const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'

    if (isProduction && getMockPaymentsEnabled()) {
      throw new Error(
        'FATAL: MOCK_PAYMENTS_ENABLED cannot be true in production. ' +
          'Set MOLLIE_API_KEY for live payments or run the app in a non-production environment.',
      )
    }

    if (options?.mock !== undefined) {
      if (isProduction && options.mock) {
        throw new Error('FATAL: mock payment provider cannot be constructed in production')
      }
      this.mockMode = options.mock
    } else {
      const mockEnabled = getMockPaymentsEnabled()
      if (!apiKey && !mockEnabled) {
        if (isProduction) {
          throw new Error(
            'FATAL: MOLLIE_API_KEY is required in production. ' +
              'Set MOLLIE_API_KEY or explicitly enable mock mode with MOCK_PAYMENTS_ENABLED=true',
          )
        }
        this.mockMode = true
      } else {
        // In production mock mode is never allowed, even if MOLLIE_API_KEY is missing.
        this.mockMode = isProduction ? false : !apiKey || mockEnabled
      }
    }

    if (!this.mockMode && !apiKey) {
      throw new Error('FATAL: MOLLIE_API_KEY is required when mock payments are disabled')
    }
  }

  // -----------------------------------------------------------------------
  // createPayment
  // -----------------------------------------------------------------------

  async createPayment(
    amountCents: number,
    currency: string,
    description: string,
    redirectUrl: string,
    webhookUrl: string,
    billingCountry?: string,
  ): Promise<CreatePaymentResult> {
    if (this.mockMode) {
      return this.createPaymentMock(amountCents, currency, description, redirectUrl)
    }

    return this.createPaymentReal(
      amountCents,
      currency,
      description,
      redirectUrl,
      webhookUrl,
      billingCountry,
    )
  }

  private async createPaymentMock(
    _amountCents: number,
    _currency: string,
    _description: string,
    redirectUrl: string,
  ): Promise<CreatePaymentResult> {
    // Simulate a short network delay for realistic behaviour in dev
    await delay(50)

    const paymentId = nextMockPaymentId()

    // Remember the requested amount so webhook amount checks match for
    // payments created through the mock checkout flow.
    mockPaymentAmounts.set(paymentId, _amountCents)

    // Build a mock checkout URL that mimics Mollie's hosted checkout. In
    // development the buyer clicks this link and the webhook fires
    // immediately after to simulate the Mollie redirect flow.
    // Extract the platform order ID from redirectUrl so the local
    // end-to-end flow does not 404.
    const baseUrl = getBaseUrl()
    const orderIdMatch = redirectUrl.match(/\/orders\/([^/]+)\/success/)
    const orderId = orderIdMatch ? orderIdMatch[1] : paymentId
    const checkoutUrl = `${baseUrl}/orders/${orderId}/success?mock_payment=${paymentId}`

    return { paymentId, checkoutUrl }
  }

  private async createPaymentReal(
    amountCents: number,
    currency: string,
    description: string,
    redirectUrl: string,
    webhookUrl: string,
    billingCountry?: string,
  ): Promise<CreatePaymentResult> {
    const apiKey = getMollieApiKey()

    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY is not set')
    }

    const body: Record<string, unknown> = {
      amount: {
        currency: currency.toUpperCase(),
        value: `${(amountCents / 100).toFixed(2)}`,
      },
      description,
      redirectUrl,
      webhookUrl,
    }

    if (billingCountry) {
      body.restrictPaymentMethodsToCountry = billingCountry
    }

    const response = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Mollie API error (${response.status}): ${errorBody}`)
    }

    const data = (await response.json()) as {
      id: string
      _links: { checkout: { href: string } }
      [key: string]: unknown
    }

    return {
      paymentId: data.id,
      checkoutUrl: data._links.checkout.href,
    }
  }

  // -----------------------------------------------------------------------
  // refundPayment
  // -----------------------------------------------------------------------

  async refundPayment(
    paymentId: string,
    amountCents?: number,
    options?: {
      reverseRouting?: boolean
      routingReversals?: { organizationId: string; amountCents: number }[]
    },
  ): Promise<void> {
    if (this.mockMode) {
      return this.refundPaymentMock(paymentId, amountCents, options)
    }

    return this.refundPaymentReal(paymentId, amountCents, options)
  }

  private async refundPaymentMock(
    paymentId: string,
    _amountCents?: number,
    _options?: {
      reverseRouting?: boolean
      routingReversals?: { organizationId: string; amountCents: number }[]
    },
  ): Promise<void> {
    // In mock mode we only validate that the payment ID looks plausible.
    // A real implementation would verify the payment exists and is refundable.
    if (!paymentId.startsWith(MOCK_ID_PREFIX) && paymentId.length < 8) {
      throw new Error(`Invalid mock payment ID: ${paymentId}`)
    }

    await delay(30)
  }

  private async refundPaymentReal(
    paymentId: string,
    amountCents?: number,
    options?: {
      reverseRouting?: boolean
      routingReversals?: { organizationId: string; amountCents: number }[]
    },
  ): Promise<void> {
    const apiKey = getMollieApiKey()

    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY is not set')
    }

    const body: Record<string, unknown> = {}

    if (amountCents !== undefined) {
      body.amount = {
        currency: 'EUR',
        value: `${(amountCents / 100).toFixed(2)}`,
      }
    }

    if (options?.reverseRouting) {
      body.reverseRouting = true
    }

    if (options?.routingReversals && options.routingReversals.length > 0) {
      body.routingReversals = options.routingReversals.map((reversal) => ({
        amount: {
          currency: 'EUR',
          value: `${(reversal.amountCents / 100).toFixed(2)}`,
        },
        source: {
          type: 'organization',
          organizationId: reversal.organizationId,
        },
      }))
    }

    if (getMollieTestMode()) {
      body.testmode = true
    }

    const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Mollie refund error (${response.status}): ${errorBody}`)
    }
  }

  // -----------------------------------------------------------------------
  // cancelPayment
  // -----------------------------------------------------------------------

  async cancelPayment(paymentId: string): Promise<void> {
    if (this.mockMode) {
      return this.cancelPaymentMock(paymentId)
    }

    return this.cancelPaymentReal(paymentId)
  }

  private async cancelPaymentMock(paymentId: string): Promise<void> {
    const status = mockPaymentStatuses.get(paymentId) ?? 'paid'
    const cancelableOverride = mockPaymentCancelable.get(paymentId)
    // E2E fixtures use tr_e2e_* IDs; in mock mode these should always be
    // cancelable so pending-payment order cancellation specs are deterministic.
    const isE2eTestPayment = paymentId.startsWith('tr_e2e_')
    const isCancelable = cancelableOverride ?? (isE2eTestPayment ? true : status !== 'paid')

    if (!isCancelable) {
      throw new Error('Payment has already been captured')
    }

    await delay(20)
  }

  private async cancelPaymentReal(paymentId: string): Promise<void> {
    const apiKey = getMollieApiKey()

    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY is not set')
    }

    const query = getMollieTestMode() ? '?testmode=true' : ''
    const response = await fetch(
      `https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}${query}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (response.status === 422) {
      const body = await response.text()
      throw new Error(`Payment has already been captured: ${body}`)
    }

    if (!response.ok && response.status !== 204) {
      const body = await response.text()
      throw new Error(`Mollie cancel payment error (${response.status}): ${body}`)
    }
  }

  // -----------------------------------------------------------------------
  // getPaymentStatus
  // -----------------------------------------------------------------------

  async getPaymentStatus(
    paymentId: string,
  ): Promise<'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback'> {
    if (this.mockMode) {
      return this.getPaymentStatusMock(paymentId)
    }

    return this.getPaymentStatusReal(paymentId)
  }

  private getPaymentStatusMock(
    paymentId: string,
  ): 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback' {
    // Return the configured status if one was set, otherwise default to paid
    // for mock payments so the happy path works out of the box.
    return mockPaymentStatuses.get(paymentId) ?? 'paid'
  }

  private async getPaymentStatusReal(
    paymentId: string,
  ): Promise<'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback'> {
    const apiKey = getMollieApiKey()

    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY is not set')
    }

    const response = await fetch(
      `https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Mollie API error (${response.status}): ${errorBody}`)
    }

    const data = (await response.json()) as {
      status: string
      amountChargedBack?: { currency: string; value: string }
      [key: string]: unknown
    }

    const chargedBackAmount = Number.parseFloat(data.amountChargedBack?.value ?? '0')
    if (Number.isFinite(chargedBackAmount) && chargedBackAmount > 0) {
      return 'chargeback'
    }

    switch (data.status) {
      case 'open':
      case 'pending':
      case 'authorized':
        return 'pending'
      case 'paid':
      case 'expired':
      case 'failed':
        return data.status
      case 'canceled':
      case 'cancelled':
        return 'cancelled'
      default:
        throw new Error(`Unexpected Mollie payment status: ${data.status}`)
    }
  }

  // -----------------------------------------------------------------------
  // getPaymentAmount
  // -----------------------------------------------------------------------

  async getPaymentAmount(paymentId: string): Promise<number> {
    if (this.mockMode) {
      return this.getPaymentAmountMock(paymentId)
    }

    return this.getPaymentAmountReal(paymentId)
  }

  private getPaymentAmountMock(paymentId: string): number {
    // Return the configured amount if one was set, otherwise default to 1000
    // cents (€10.00) so existing tests pass without explicit configuration.
    return mockPaymentAmounts.get(paymentId) ?? 1000
  }

  private async getPaymentAmountReal(paymentId: string): Promise<number> {
    const apiKey = getMollieApiKey()

    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY is not set')
    }

    const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Mollie API error (${response.status}): ${errorBody}`)
    }

    const data = (await response.json()) as {
      amount: { currency: string; value: string }
      [key: string]: unknown
    }

    const value = data.amount.value
    const parsed = Number.parseFloat(value)
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid Mollie payment amount: ${value}`)
    }

    return Math.round(parsed * 100)
  }
}

// ---------------------------------------------------------------------------
// Default singleton
// ---------------------------------------------------------------------------

/** Default Mollie payment provider instance used by the application. */
export const molliePaymentProvider = new MolliePaymentProvider()

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
