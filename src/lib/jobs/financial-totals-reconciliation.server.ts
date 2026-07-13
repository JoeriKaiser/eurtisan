import { randomUUID } from 'node:crypto'

import {
  FINANCIAL_MISMATCH_CATEGORIES,
  type FinancialMismatch,
  type FinancialReconciliationOptions,
  type FinancialReconciliationResult,
  reconcileFinancialTotals,
} from '#/lib/financial-totals.server'
import { logger } from '#/lib/logger.server'
import {
  financialReconciliationLastRunMismatches,
  financialReconciliationMismatchesTotal,
  financialReconciliationRecordsCheckedTotal,
} from '#/lib/metrics.server'

export const FINANCIAL_TOTALS_JOB_NAME = 'financial-totals-reconciliation'

interface FinancialReconciliationDependencies {
  reconcile?: (options: FinancialReconciliationOptions) => Promise<FinancialReconciliationResult>
  runId?: string
}

export async function runFinancialTotalsReconciliation(
  batchSize: number,
  dependencies: FinancialReconciliationDependencies = {},
): Promise<FinancialReconciliationResult> {
  const runId = dependencies.runId ?? randomUUID()
  const reconcile = dependencies.reconcile ?? reconcileFinancialTotals
  const onMismatch = (mismatch: FinancialMismatch) => {
    logger.error('Financial invariant mismatch detected', undefined, {
      alert: true,
      job: FINANCIAL_TOTALS_JOB_NAME,
      runId,
      category: mismatch.category,
      entityType: mismatch.entityType,
      entityId: mismatch.entityId,
      fieldName: mismatch.fieldName,
      storedCents: mismatch.storedCents,
      computedCents: mismatch.computedCents,
      differenceCents: mismatch.differenceCents,
    })
  }

  const result = await reconcile({ batchSize, onMismatch })

  for (const [entity, checked] of Object.entries(result.recordsChecked)) {
    financialReconciliationRecordsCheckedTotal.inc({ entity }, checked)
  }
  for (const category of FINANCIAL_MISMATCH_CATEGORIES) {
    const count = result.mismatchCounts[category]
    financialReconciliationLastRunMismatches.set({ category }, count)
    if (count > 0) financialReconciliationMismatchesTotal.inc({ category }, count)
  }

  logger.info('Financial totals reconciliation completed', {
    job: FINANCIAL_TOTALS_JOB_NAME,
    runId,
    recordsChecked: result.recordsChecked,
    mismatches: result.mismatches,
    mismatchCounts: result.mismatchCounts,
    readOnly: true,
  })

  return result
}
