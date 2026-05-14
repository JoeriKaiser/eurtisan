import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { MolliePaymentProvider, resetMockPaymentCounter } from '#/integrations/mollie'
import { getBaseUrl } from './env.server'

beforeEach(() => {
  resetMockPaymentCounter()
})

afterAll(() => {
  resetMockPaymentCounter()
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
      await expect(
        provider.refundPayment('tr_mock_000001', 500),
      ).resolves.toBeUndefined()
    })

    it('succeeds without an amount (full refund)', async () => {
      await expect(
        provider.refundPayment('tr_mock_000042'),
      ).resolves.toBeUndefined()
    })

    it('throws for an obviously invalid payment ID', async () => {
      await expect(
        provider.refundPayment('invalid', 500),
      ).rejects.toThrow('Invalid mock payment ID')
    })
  })
})
