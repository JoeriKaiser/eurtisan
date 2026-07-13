import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FINANCIAL_MISMATCH_CATEGORIES,
  type FinancialReconciliationResult,
} from '#/lib/financial-totals.server'
import { logger } from '#/lib/logger.server'
import { metricsRegistry } from '#/lib/metrics.server'
import { runFinancialTotalsReconciliation } from './financial-totals-reconciliation.server'

vi.mock('#/lib/logger.server', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

function resultWithMismatch(): FinancialReconciliationResult {
  return {
    recordsChecked: {
      order_item: 3,
      shop_order: 2,
      platform_order: 1,
      invoice: 2,
      payout: 1,
    },
    mismatches: 1,
    mismatchCounts: Object.fromEntries(
      FINANCIAL_MISMATCH_CATEGORIES.map((category) => [
        category,
        category === 'platform_order_total' ? 1 : 0,
      ]),
    ) as FinancialReconciliationResult['mismatchCounts'],
  }
}

function metricValue(name: string, labels: Record<string, string>): number {
  const metric = metricsRegistry.getSingleMetric(name) as unknown as {
    hashMap: Record<string, { value: number; labels: Record<string, string> }>
  }
  return (
    Object.values(metric.hashMap).find((entry) =>
      Object.entries(labels).every(([key, value]) => entry.labels[key] === value),
    )?.value ?? 0
  )
}

describe('runFinancialTotalsReconciliation', () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics()
    vi.clearAllMocks()
  })

  it('emits non-PII checked-record and mismatch metrics plus a correlation id', async () => {
    const mismatch = {
      category: 'platform_order_total' as const,
      entityType: 'platform_order' as const,
      entityId: '00000000-0000-0000-0000-000000000001',
      fieldName: 'totalCents',
      storedCents: 100,
      computedCents: 110,
      differenceCents: 10,
    }
    const reconcile = vi.fn(async ({ onMismatch }) => {
      await onMismatch?.(mismatch)
      return resultWithMismatch()
    })

    await runFinancialTotalsReconciliation(500, { reconcile, runId: 'run-correlation-id' })

    expect(logger.error).toHaveBeenCalledWith(
      'Financial invariant mismatch detected',
      undefined,
      expect.objectContaining({
        alert: true,
        runId: 'run-correlation-id',
        category: 'platform_order_total',
        entityId: mismatch.entityId,
      }),
    )
    expect(
      metricValue('eurtisan_financial_reconciliation_records_checked_total', {
        entity: 'order_item',
      }),
    ).toBe(3)
    expect(
      metricValue('eurtisan_financial_reconciliation_mismatches_total', {
        category: 'platform_order_total',
      }),
    ).toBe(1)
    expect(
      metricValue('eurtisan_financial_reconciliation_last_run_mismatches', {
        category: 'platform_order_total',
      }),
    ).toBe(1)
  })

  it('resets last-run category gauges after a balanced run', async () => {
    await runFinancialTotalsReconciliation(500, {
      reconcile: async () => resultWithMismatch(),
      runId: 'first-run',
    })
    const balanced = resultWithMismatch()
    balanced.mismatches = 0
    for (const category of FINANCIAL_MISMATCH_CATEGORIES) balanced.mismatchCounts[category] = 0

    await runFinancialTotalsReconciliation(500, {
      reconcile: async () => balanced,
      runId: 'second-run',
    })

    expect(
      metricValue('eurtisan_financial_reconciliation_last_run_mismatches', {
        category: 'platform_order_total',
      }),
    ).toBe(0)
  })
})
