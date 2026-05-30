/**
 * Mollie payment provider production-safety tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MolliePaymentProvider, resetMockPaymentCounter } from './mollie-payment-provider'

const originalEnv: Record<string, string | undefined> = {}

function setEnv(key: string, value: string | undefined) {
  if (!(key in originalEnv)) {
    originalEnv[key] = process.env[key]
  }
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(() => {
  resetMockPaymentCounter()
})

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  for (const key of Object.keys(originalEnv)) {
    delete originalEnv[key]
  }
})

describe('MolliePaymentProvider production safety', () => {
  it('throws in production when MOLLIE_API_KEY is missing and MOCK_PAYMENTS_ENABLED is not true', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('MOLLIE_API_KEY', '')
    setEnv('MOCK_PAYMENTS_ENABLED', 'false')

    expect(() => new MolliePaymentProvider()).toThrow(
      'FATAL: MOLLIE_API_KEY is required in production',
    )
  })

  it('throws in production when MOLLIE_API_KEY is missing and MOCK_PAYMENTS_ENABLED is unset', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('MOLLIE_API_KEY', '')
    setEnv('MOCK_PAYMENTS_ENABLED', undefined)

    expect(() => new MolliePaymentProvider()).toThrow(
      'FATAL: MOLLIE_API_KEY is required in production',
    )
  })

  it('works in production when MOCK_PAYMENTS_ENABLED is explicitly true', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('MOLLIE_API_KEY', '')
    setEnv('MOCK_PAYMENTS_ENABLED', 'true')
    setEnv('PUBLIC_URL', 'https://example.com')

    const provider = new MolliePaymentProvider()
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

  it('works in production when MOLLIE_API_KEY is set', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('MOLLIE_API_KEY', 'test_live_key')
    setEnv('MOCK_PAYMENTS_ENABLED', 'false')

    const provider = new MolliePaymentProvider()
    // Real mode is selected; createPayment will attempt a network call
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

  it('does not throw in development when MOLLIE_API_KEY is missing and MOCK_PAYMENTS_ENABLED is not true', () => {
    setEnv('NODE_ENV', 'development')
    setEnv('MOLLIE_API_KEY', '')
    setEnv('MOCK_PAYMENTS_ENABLED', 'false')

    const provider = new MolliePaymentProvider()
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

describe('verifyWebhookReal malformed signatures', () => {
  beforeEach(() => {
    setEnv('MOLLIE_API_KEY', 'test_key')
    setEnv('MOLLIE_WEBHOOK_SECRET', 'test_secret')
  })

  it('throws TypeError for an empty signature', async () => {
    const provider = new MolliePaymentProvider({ mock: false })
    await expect(provider.verifyWebhook({ id: 'tr_test' }, '', 'body')).rejects.toBeInstanceOf(
      TypeError,
    )
  })

  it('throws TypeError for a signature with invalid characters', async () => {
    const provider = new MolliePaymentProvider({ mock: false })
    await expect(
      provider.verifyWebhook({ id: 'tr_test' }, 'not-valid!', 'body'),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('throws RangeError for a signature with the wrong length', async () => {
    const provider = new MolliePaymentProvider({ mock: false })
    // Valid base64 but wrong length for HMAC-SHA256 (should be 44 chars).
    await expect(
      provider.verifyWebhook({ id: 'tr_test' }, 'aGVsbG8=', 'body'),
    ).rejects.toBeInstanceOf(RangeError)
  })
})
