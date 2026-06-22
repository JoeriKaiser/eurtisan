import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertMockPayoutsNotProduction } from './env.server'

describe('assertMockPayoutsNotProduction', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalMockPayouts = process.env.MOCK_PAYOUTS_ENABLED

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = originalNodeEnv
    if (originalMockPayouts === undefined) {
      delete process.env.MOCK_PAYOUTS_ENABLED
    } else {
      process.env.MOCK_PAYOUTS_ENABLED = originalMockPayouts
    }
  })

  it('throws when running in production with mock payouts enabled', () => {
    process.env.NODE_ENV = 'production'
    process.env.MOCK_PAYOUTS_ENABLED = 'true'

    expect(() => assertMockPayoutsNotProduction()).toThrow(
      'MOCK_PAYOUTS_ENABLED=true is not allowed in production',
    )
  })

  it('does not throw when mock payouts are disabled in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.MOCK_PAYOUTS_ENABLED = 'false'

    expect(() => assertMockPayoutsNotProduction()).not.toThrow()
  })

  it('does not throw in non-production environments even when mock payouts are enabled', () => {
    process.env.NODE_ENV = 'development'
    process.env.MOCK_PAYOUTS_ENABLED = 'true'

    expect(() => assertMockPayoutsNotProduction()).not.toThrow()
  })
})
