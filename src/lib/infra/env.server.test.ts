import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertMockPayoutsNotProduction,
  getFinancialTotalsReconciliationBatchSize,
  getFinancialTotalsReconciliationIntervalMs,
  getHealthDiskThresholdBytes,
  getMolliePaymentReconciliationBatchSize,
  getMolliePaymentReconciliationIntervalMs,
  getMolliePaymentReconciliationMinAgeMs,
} from './env.server'

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

describe('Mollie payment reconciliation configuration', () => {
  const keys = [
    'MOLLIE_PAYMENT_RECONCILIATION_INTERVAL_MS',
    'MOLLIE_PAYMENT_RECONCILIATION_MIN_AGE_MS',
    'MOLLIE_PAYMENT_RECONCILIATION_BATCH_SIZE',
  ] as const
  const originalValues = new Map(keys.map((key) => [key, process.env[key]]))

  afterEach(() => {
    for (const key of keys) {
      const original = originalValues.get(key)
      if (original === undefined) delete process.env[key]
      else process.env[key] = original
    }
  })

  it('uses safe defaults when tuning variables are unset', () => {
    for (const key of keys) delete process.env[key]

    expect(getMolliePaymentReconciliationIntervalMs()).toBe(120_000)
    expect(getMolliePaymentReconciliationMinAgeMs()).toBe(60_000)
    expect(getMolliePaymentReconciliationBatchSize()).toBe(100)
  })

  it('accepts positive integer tuning values', () => {
    process.env.MOLLIE_PAYMENT_RECONCILIATION_INTERVAL_MS = '300000'
    process.env.MOLLIE_PAYMENT_RECONCILIATION_MIN_AGE_MS = '90000'
    process.env.MOLLIE_PAYMENT_RECONCILIATION_BATCH_SIZE = '25'

    expect(getMolliePaymentReconciliationIntervalMs()).toBe(300_000)
    expect(getMolliePaymentReconciliationMinAgeMs()).toBe(90_000)
    expect(getMolliePaymentReconciliationBatchSize()).toBe(25)
  })

  it('rejects invalid and non-positive tuning values', () => {
    process.env.MOLLIE_PAYMENT_RECONCILIATION_INTERVAL_MS = 'invalid'
    process.env.MOLLIE_PAYMENT_RECONCILIATION_MIN_AGE_MS = '0'
    process.env.MOLLIE_PAYMENT_RECONCILIATION_BATCH_SIZE = '-5'

    expect(getMolliePaymentReconciliationIntervalMs()).toBe(120_000)
    expect(getMolliePaymentReconciliationMinAgeMs()).toBe(60_000)
    expect(getMolliePaymentReconciliationBatchSize()).toBe(100)
  })
})

describe('financial totals reconciliation configuration', () => {
  const intervalName = 'FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS'
  const batchName = 'FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE'
  const originalInterval = process.env[intervalName]
  const originalBatch = process.env[batchName]

  afterEach(() => {
    if (originalInterval === undefined) delete process.env[intervalName]
    else process.env[intervalName] = originalInterval
    if (originalBatch === undefined) delete process.env[batchName]
    else process.env[batchName] = originalBatch
  })

  it('uses the launch-safe six-hour cadence and 500-record batch defaults', () => {
    delete process.env[intervalName]
    delete process.env[batchName]
    expect(getFinancialTotalsReconciliationIntervalMs()).toBe(21_600_000)
    expect(getFinancialTotalsReconciliationBatchSize()).toBe(500)
  })

  it('bounds unsafe cadence and batch values', () => {
    process.env[intervalName] = '60000'
    process.env[batchName] = '99999'
    expect(getFinancialTotalsReconciliationIntervalMs()).toBe(300_000)
    expect(getFinancialTotalsReconciliationBatchSize()).toBe(5_000)
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
