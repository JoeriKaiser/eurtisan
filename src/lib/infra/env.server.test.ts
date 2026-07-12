import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertMockPayoutsNotProduction, getHealthDiskThresholdBytes } from './env.server'

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

describe('getHealthDiskThresholdBytes', () => {
  const originalValue = process.env.HEALTH_DISK_THRESHOLD_BYTES

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.HEALTH_DISK_THRESHOLD_BYTES
    } else {
      process.env.HEALTH_DISK_THRESHOLD_BYTES = originalValue
    }
  })

  it('returns the default 500 MB when the variable is unset', () => {
    delete process.env.HEALTH_DISK_THRESHOLD_BYTES
    expect(getHealthDiskThresholdBytes()).toBe(500 * 1024 * 1024)
  })

  it('parses a positive integer value', () => {
    process.env.HEALTH_DISK_THRESHOLD_BYTES = '1073741824'
    expect(getHealthDiskThresholdBytes()).toBe(1073741824)
  })

  it('falls back to the default for non-numeric values', () => {
    process.env.HEALTH_DISK_THRESHOLD_BYTES = 'not-a-number'
    expect(getHealthDiskThresholdBytes()).toBe(500 * 1024 * 1024)
  })

  it('falls back to the default for non-positive values', () => {
    process.env.HEALTH_DISK_THRESHOLD_BYTES = '-1'
    expect(getHealthDiskThresholdBytes()).toBe(500 * 1024 * 1024)
  })
})
