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

  it('throws in production when MOCK_PAYMENTS_ENABLED is explicitly true', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('MOLLIE_API_KEY', '')
    setEnv('MOCK_PAYMENTS_ENABLED', 'true')

    expect(() => new MolliePaymentProvider()).toThrow(
      'FATAL: MOCK_PAYMENTS_ENABLED cannot be true in production',
    )
  })

  it('throws in production when constructed with mock: true', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('MOLLIE_API_KEY', 'test_live_key')
    setEnv('MOCK_PAYMENTS_ENABLED', 'false')

    expect(() => new MolliePaymentProvider({ mock: true })).toThrow(
      'FATAL: mock payment provider cannot be constructed in production',
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

  it('accepts billingCountry parameter in mock mode', () => {
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
        'FR',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        paymentId: expect.stringMatching(/^tr_mock_/),
      }),
    )
  })
})
