/**
 * Mollie payment provider — mock implementation.
 *
 * When MOLLIE_API_KEY is configured this module will eventually call the real
 * Mollie API. Until a business is registered the API calls are mocked so the
 * full payment flow (create → webhook → status update → refund) works
 * end-to-end in development.
 *
 * The mock generates predictable payment IDs and signatures so the webhook
 * handler can be tested deterministically.
 */
import { getBaseUrl } from '#/lib/env.server'
import type { CreatePaymentResult, PaymentProvider } from '#/lib/payment-provider'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Deterministic mock payment ID prefix so webhooks can locate orders. */
const MOCK_ID_PREFIX = 'tr_mock_'

let mockCounter = 0

function nextMockPaymentId(): string {
  mockCounter += 1
  return `${MOCK_ID_PREFIX}${String(mockCounter).padStart(6, '0')}`
}

/**
 * The mock webhook signature is simply `mock_sig_<paymentId>`.
 * In production this would be an HMAC-SHA256 computed with
 * `MOLLIE_WEBHOOK_SECRET`.
 */
function mockSignature(paymentId: string): string {
  return `mock_sig_${paymentId}`
}

/**
 * For tests we expose the counter reset so tests are deterministic.
 */
export function resetMockPaymentCounter(): void {
  mockCounter = 0
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
    this.mockMode = options?.mock ?? true
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
  ): Promise<CreatePaymentResult> {
    if (this.mockMode) {
      return this.createPaymentMock(amountCents, currency, description, redirectUrl)
    }

    return this.createPaymentReal(amountCents, currency, description, redirectUrl, webhookUrl)
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

    // Build a mock checkout URL that mimics Mollie's hosted checkout. In
    // development the buyer clicks this link and the webhook fires
    // immediately after to simulate the Mollie redirect flow.
    const baseUrl = getBaseUrl()
    const checkoutUrl = `${baseUrl}/orders/${paymentId}/success?mock_payment=${paymentId}`

    return { paymentId, checkoutUrl }
  }

  private async createPaymentReal(
    amountCents: number,
    currency: string,
    description: string,
    redirectUrl: string,
    webhookUrl: string,
  ): Promise<CreatePaymentResult> {
    const apiKey = process.env.MOLLIE_API_KEY

    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY is not set')
    }

    const body = {
      amount: {
        currency: currency.toUpperCase(),
        value: `${(amountCents / 100).toFixed(2)}`,
      },
      description,
      redirectUrl,
      webhookUrl,
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
  // verifyWebhook
  // -----------------------------------------------------------------------

  async verifyWebhook(payload: unknown, signature: string, rawBody?: string): Promise<boolean> {
    if (this.mockMode) {
      return this.verifyWebhookMock(payload, signature)
    }

    return this.verifyWebhookReal(payload, signature, rawBody)
  }

  private verifyWebhookMock(payload: unknown, signature: string): boolean {
    // In mock mode we accept any payload with a payment ID that matches the
    // signature pattern.
    if (!payload || typeof payload !== 'object') return false

    const id = (payload as Record<string, unknown>).id
    if (typeof id !== 'string') return false

    const expectedSig = mockSignature(id)
    return signature === expectedSig
  }

  private async verifyWebhookReal(
    _payload: unknown,
    signature: string,
    rawBody?: string,
  ): Promise<boolean> {
    const secret = process.env.MOLLIE_WEBHOOK_SECRET

    if (!secret) {
      throw new Error('MOLLIE_WEBHOOK_SECRET is not set')
    }

    // Mollie signs webhooks by computing HMAC-SHA256 over the raw request
    // body with the webhook secret, then base64-encodes the result.
    //
    // The raw body must be available; if it wasn't provided (e.g. body was
    // already consumed) we cannot verify and must reject.
    if (!rawBody) {
      return false
    }

    const cryptoModule = await import('node:crypto')
    const computedHmac = cryptoModule
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64')

    return cryptoModule.timingSafeEqual(
      Buffer.from(computedHmac),
      Buffer.from(signature),
    )
  }

  // -----------------------------------------------------------------------
  // refundPayment
  // -----------------------------------------------------------------------

  async refundPayment(paymentId: string, amountCents?: number): Promise<void> {
    if (this.mockMode) {
      return this.refundPaymentMock(paymentId, amountCents)
    }

    return this.refundPaymentReal(paymentId, amountCents)
  }

  private async refundPaymentMock(
    paymentId: string,
    _amountCents?: number,
  ): Promise<void> {
    await delay(30)

    // In mock mode we only validate that the payment ID looks plausible.
    // A real implementation would verify the payment exists and is refundable.
    if (!paymentId.startsWith(MOCK_ID_PREFIX) && paymentId.length < 8) {
      throw new Error(`Invalid mock payment ID: ${paymentId}`)
    }
  }

  private async refundPaymentReal(
    paymentId: string,
    amountCents?: number,
  ): Promise<void> {
    const apiKey = process.env.MOLLIE_API_KEY

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

    const response = await fetch(
      `https://api.mollie.com/v2/payments/${paymentId}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Mollie refund error (${response.status}): ${errorBody}`)
    }
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
