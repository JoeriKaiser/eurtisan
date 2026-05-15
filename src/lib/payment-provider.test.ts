import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MolliePaymentProvider,
  resetMockPaymentCounter,
  resetMockPaymentStatuses,
  setMockPaymentStatus,
} from '#/integrations/mollie'
import { getBaseUrl } from './env.server'

beforeEach(() => {
  resetMockPaymentCounter()
  resetMockPaymentStatuses()
  vi.unstubAllEnvs()
})

afterAll(() => {
  resetMockPaymentCounter()
  resetMockPaymentStatuses()
  vi.unstubAllEnvs()
})

describe('MolliePaymentProvider (mock)', () => {
  const provider = new MolliePaymentProvider({ mock: true })

  describe('createPayment', () => {
    it('returns a payment ID and checkout URL', async () => {
      const result = await provider.createPayment(
        2500,
        'EUR',
        'Order description',
        'https://example.com/redirect',
        'https://example.com/webhook',
      )

      expect(result.paymentId).toMatch(/^tr_mock_\d{6}$/)
      expect(result.checkoutUrl).toContain(getBaseUrl())
      expect(result.checkoutUrl).toContain('/success')
    })

    it('generates unique payment IDs across calls', async () => {
      const r1 = await provider.createPayment(1000, 'EUR', 'Order 1', '/r1', '/w1')
      const r2 = await provider.createPayment(1000, 'EUR', 'Order 2', '/r2', '/w2')

      expect(r1.paymentId).not.toBe(r2.paymentId)
    })

    it('uses the platform order ID from redirectUrl in the mock checkout URL', async () => {
      const orderId = '10000000-0000-0000-0000-000000000042'
      const redirectUrl = `https://example.com/orders/${orderId}/success`

      const result = await provider.createPayment(
        2500,
        'EUR',
        'Order description',
        redirectUrl,
        'https://example.com/webhook',
      )

      expect(result.checkoutUrl).toContain(`/orders/${orderId}/success`)
    })

    it('falls back to payment ID when redirectUrl has no order ID', async () => {
      const result = await provider.createPayment(
        2500,
        'EUR',
        'Order description',
        'https://example.com/redirect',
        'https://example.com/webhook',
      )

      expect(result.checkoutUrl).toContain(result.paymentId)
    })
  })

  describe('verifyWebhook', () => {
    it('returns true for valid mock signature', async () => {
      const paymentId = 'tr_mock_000001'
      const payload = { id: paymentId }
      const signature = `mock_sig_${paymentId}`

      const result = await provider.verifyWebhook(payload, signature)
      expect(result).toBe(true)
    })

    it('returns false for invalid signature', async () => {
      const payload = { id: 'tr_mock_000001' }
      const signature = 'wrong_signature'

      const result = await provider.verifyWebhook(payload, signature)
      expect(result).toBe(false)
    })

    it('returns false when payload has no id', async () => {
      const payload = { status: 'paid' }
      const signature = 'mock_sig_tr_mock_000001'

      const result = await provider.verifyWebhook(payload, signature)
      expect(result).toBe(false)
    })

    it('returns false for non-object payload', async () => {
      const result = await provider.verifyWebhook('not_an_object', 'any_sig')
      expect(result).toBe(false)
    })

    it('returns false for null payload', async () => {
      const result = await provider.verifyWebhook(null, 'any_sig')
      expect(result).toBe(false)
    })
  })

  describe('refundPayment', () => {
    it('succeeds with a valid mock payment ID', async () => {
      await expect(provider.refundPayment('tr_mock_000001', 500)).resolves.toBeUndefined()
    })

    it('succeeds without an amount (full refund)', async () => {
      await expect(provider.refundPayment('tr_mock_000042')).resolves.toBeUndefined()
    })

    it('throws for an obviously invalid payment ID', async () => {
      await expect(provider.refundPayment('invalid', 500)).rejects.toThrow(
        'Invalid mock payment ID',
      )
    })
  })

  describe('getPaymentStatus', () => {
    it('defaults to paid for mock payments', async () => {
      const status = await provider.getPaymentStatus('tr_mock_000001')
      expect(status).toBe('paid')
    })

    it('returns configured status when set', async () => {
      setMockPaymentStatus('tr_mock_000001', 'expired')
      const status = await provider.getPaymentStatus('tr_mock_000001')
      expect(status).toBe('expired')
    })

    it('returns different statuses for different payment IDs', async () => {
      setMockPaymentStatus('tr_mock_000001', 'pending')
      setMockPaymentStatus('tr_mock_000002', 'failed')

      const s1 = await provider.getPaymentStatus('tr_mock_000001')
      const s2 = await provider.getPaymentStatus('tr_mock_000002')

      expect(s1).toBe('pending')
      expect(s2).toBe('failed')
    })
  })
})

describe('MolliePaymentProvider real-mode detection', () => {
  it('defaults to mock mode when MOLLIE_API_KEY is not set', () => {
    vi.stubEnv('MOLLIE_API_KEY', '')
    const provider = new MolliePaymentProvider()
    // Verify mock mode by checking createPayment returns a mock ID
    return expect(
      provider.createPayment(
        1000,
        'EUR',
        'Test',
        'https://example.com/orders/123/success',
        'https://example.com/webhook',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        paymentId: expect.stringMatching(/^tr_mock_/),
      }),
    )
  })

  it('enters real mode when MOLLIE_API_KEY is present', () => {
    vi.stubEnv('MOLLIE_API_KEY', 'test_live_key')
    const provider = new MolliePaymentProvider()
    // Verify real mode by checking that createPayment throws (no network mock)
    return expect(
      provider.createPayment(
        1000,
        'EUR',
        'Test',
        'https://example.com/redirect',
        'https://example.com/webhook',
      ),
    ).rejects.toThrow()
  })

  it('allows explicit mock override even when MOLLIE_API_KEY is set', () => {
    vi.stubEnv('MOLLIE_API_KEY', 'test_live_key')
    const provider = new MolliePaymentProvider({ mock: true })
    return expect(
      provider.createPayment(
        1000,
        'EUR',
        'Test',
        'https://example.com/orders/123/success',
        'https://example.com/webhook',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        paymentId: expect.stringMatching(/^tr_mock_/),
      }),
    )
  })
})

describe('MolliePaymentProvider (real with mocked fetch)', () => {
  let provider: MolliePaymentProvider

  beforeEach(() => {
    vi.stubEnv('MOLLIE_API_KEY', 'test_live_key')
    provider = new MolliePaymentProvider()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createPayment', () => {
    it('calls the real Mollie API and returns payment details', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'tr_real_12345',
            _links: { checkout: { href: 'https://checkout.mollie.com/pay/tr_real_12345' } },
          }),
          { status: 200 },
        ),
      )

      const result = await provider.createPayment(
        2500,
        'EUR',
        'Real order',
        'https://example.com/redirect',
        'https://example.com/webhook',
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.mollie.com/v2/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_live_key',
          }),
        }),
      )

      expect(result.paymentId).toBe('tr_real_12345')
      expect(result.checkoutUrl).toBe('https://checkout.mollie.com/pay/tr_real_12345')
    })

    it('throws on API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ status: 401, title: 'Unauthorized request' }), {
          status: 401,
        }),
      )

      await expect(
        provider.createPayment(
          1000,
          'EUR',
          'Test',
          'https://example.com/redirect',
          'https://example.com/webhook',
        ),
      ).rejects.toThrow('Mollie API error (401)')
    })
  })

  describe('getPaymentStatus', () => {
    it('queries the Mollie API and returns the status', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'tr_real_12345', status: 'pending' }), { status: 200 }),
        )

      const status = await provider.getPaymentStatus('tr_real_12345')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.mollie.com/v2/payments/tr_real_12345',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_live_key',
          }),
        }),
      )

      expect(status).toBe('pending')
    })

    it('returns paid status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'tr_real_12345', status: 'paid' }), { status: 200 }),
      )

      const status = await provider.getPaymentStatus('tr_real_12345')
      expect(status).toBe('paid')
    })

    it('returns expired status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'tr_real_12345', status: 'expired' }), { status: 200 }),
      )

      const status = await provider.getPaymentStatus('tr_real_12345')
      expect(status).toBe('expired')
    })

    it('returns failed status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'tr_real_12345', status: 'failed' }), { status: 200 }),
      )

      const status = await provider.getPaymentStatus('tr_real_12345')
      expect(status).toBe('failed')
    })

    it('returns cancelled status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'tr_real_12345', status: 'cancelled' }), { status: 200 }),
      )

      const status = await provider.getPaymentStatus('tr_real_12345')
      expect(status).toBe('cancelled')
    })

    it('throws on API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ status: 404, title: 'Not found' }), { status: 404 }),
      )

      await expect(provider.getPaymentStatus('tr_real_unknown')).rejects.toThrow(
        'Mollie API error (404)',
      )
    })

    it('throws for unexpected status values', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'tr_real_12345', status: 'open' }), { status: 200 }),
      )

      await expect(provider.getPaymentStatus('tr_real_12345')).rejects.toThrow(
        'Unexpected Mollie payment status: open',
      )
    })
  })

  describe('refundPayment', () => {
    it('calls the Mollie refund endpoint', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ id: 're_12345' }), { status: 201 }))

      await provider.refundPayment('tr_real_12345', 500)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.mollie.com/v2/payments/tr_real_12345/refunds',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_live_key',
          }),
        }),
      )
    })
  })

  describe('verifyWebhook', () => {
    it('verifies HMAC signature with MOLLIE_WEBHOOK_SECRET', async () => {
      vi.stubEnv('MOLLIE_WEBHOOK_SECRET', 'test_secret')

      const payload = { id: 'tr_real_12345' }
      const rawBody = JSON.stringify(payload)

      const crypto = await import('node:crypto')
      const expectedSig = crypto
        .createHmac('sha256', 'test_secret')
        .update(rawBody)
        .digest('base64')

      const result = await provider.verifyWebhook(payload, expectedSig, rawBody)
      expect(result).toBe(true)
    })

    it('returns false when rawBody is missing', async () => {
      vi.stubEnv('MOLLIE_WEBHOOK_SECRET', 'test_secret')

      const result = await provider.verifyWebhook({ id: 'tr_real_12345' }, 'some_sig')
      expect(result).toBe(false)
    })

    it('throws when MOLLIE_WEBHOOK_SECRET is not set', async () => {
      vi.stubEnv('MOLLIE_WEBHOOK_SECRET', '')

      await expect(
        provider.verifyWebhook({ id: 'tr_real_12345' }, 'some_sig', 'raw'),
      ).rejects.toThrow('MOLLIE_WEBHOOK_SECRET is not set')
    })
  })
})
