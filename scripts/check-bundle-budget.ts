import { readFileSync } from 'node:fs'

import {
  BUNDLE_METRIC_NAMES,
  checkBundleBudget,
  getEffectiveBundleMaximum,
  measureClientBundle,
  parseBundleBudgetConfig,
} from '../src/lib/infra/bundle-budget'

const configPath = process.env.BUNDLE_BUDGET_CONFIG ?? 'config/bundle-budgets.json'
const assetDirectory = process.env.BUNDLE_ASSET_DIRECTORY ?? 'dist/client/assets'
const config = parseBundleBudgetConfig(JSON.parse(readFileSync(configPath, 'utf8')))
const actual = measureClientBundle(assetDirectory)
const violations = checkBundleBudget(actual, config)

console.log('Production client bundle budget (bytes):')
for (const metric of BUNDLE_METRIC_NAMES) {
  const incrementalMaximum = config.incrementalMaximum[metric]
  const policy =
    incrementalMaximum === undefined
      ? `maximum=${config.maximum[metric]}`
      : `changeMaximum=${incrementalMaximum} effectiveMaximum=${getEffectiveBundleMaximum(metric, config)} globalMaximum=${config.maximum[metric]}`
  console.log(`- ${metric}: actual=${actual[metric]} baseline=${config.baseline[metric]} ${policy}`)
}

if (violations.length > 0) {
  console.error(
    'Bundle budget exceeded. Update the implementation or review and re-measure the budget:',
  )
  for (const violation of violations) {
    console.error(`- ${violation.metric}: ${violation.actual} > ${violation.maximum}`)
  }
  process.exit(1)
}
