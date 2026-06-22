import { db } from '#/db/index'
import { reconcileFinancialTotals } from '#/lib/financial-totals.server'
import { logger } from '#/lib/logger.server'

async function main(): Promise<void> {
  logger.info('Starting financial totals reconciliation job')
  const discrepancyCount = await db.transaction(async (tx) => reconcileFinancialTotals(tx))
  logger.info(`Financial totals reconciliation completed: ${discrepancyCount} discrepancies found`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Financial totals reconciliation job failed', err)
    process.exit(1)
  })
