import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

export const BUNDLE_METRIC_NAMES = [
  'javascriptBytes',
  'javascriptGzipBytes',
  'largestJavaScriptBytes',
  'largestJavaScriptGzipBytes',
  'initialJavaScriptBytes',
  'initialJavaScriptGzipBytes',
  'largestAsyncJavaScriptBytes',
  'largestAsyncJavaScriptGzipBytes',
  'cssBytes',
  'cssGzipBytes',
] as const

export type BundleMetricName = (typeof BUNDLE_METRIC_NAMES)[number]
export type BundleMetrics = Record<BundleMetricName, number>

export interface BundleBudgetConfig {
  rationale: string
  baseline: BundleMetrics
  maximum: BundleMetrics
  incrementalMaximum: Partial<BundleMetrics>
}

export interface BundleBudgetViolation {
  metric: BundleMetricName
  actual: number
  maximum: number
}

interface AssetMeasurement {
  fileName: string
  contents: Buffer
  bytes: number
  gzipBytes: number
}

function measureFiles(assetDirectory: string, extension: string): AssetMeasurement[] {
  return readdirSync(assetDirectory)
    .filter((fileName) => fileName.endsWith(extension))
    .sort()
    .map((fileName) => {
      const path = join(assetDirectory, fileName)
      const contents = readFileSync(path)
      return {
        fileName,
        contents,
        bytes: statSync(path).size,
        gzipBytes: gzipSync(contents, { level: 9 }).length,
      }
    })
}

function sum(measurements: AssetMeasurement[], key: 'bytes' | 'gzipBytes'): number {
  return measurements.reduce((total, measurement) => total + measurement[key], 0)
}

function largest(measurements: AssetMeasurement[], key: 'bytes' | 'gzipBytes'): number {
  return measurements.reduce((maximum, measurement) => Math.max(maximum, measurement[key]), 0)
}

function findInitialJavaScript(javascript: AssetMeasurement[]): Set<string> {
  const entry = javascript.find(({ contents }) => contents.includes('__vite__mapDeps'))
  if (!entry) throw new Error('Could not identify the Vite client entry chunk')

  const byFileName = new Map(javascript.map((measurement) => [measurement.fileName, measurement]))
  const initial = new Set<string>()
  const visit = (fileName: string) => {
    if (initial.has(fileName)) return
    const measurement = byFileName.get(fileName)
    if (!measurement) return
    initial.add(fileName)
    const code = measurement.contents.toString('utf8')
    for (const match of code.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
      if (match[1]) visit(match[1])
    }
  }
  visit(entry.fileName)
  return initial
}

export function measureClientBundle(assetDirectory: string): BundleMetrics {
  const javascript = measureFiles(assetDirectory, '.js')
  const css = measureFiles(assetDirectory, '.css')

  if (javascript.length === 0) throw new Error(`No JavaScript assets found in ${assetDirectory}`)
  if (css.length === 0) throw new Error(`No CSS assets found in ${assetDirectory}`)

  const initialFileNames = findInitialJavaScript(javascript)
  const initialJavaScript = javascript.filter(({ fileName }) => initialFileNames.has(fileName))
  const asyncJavaScript = javascript.filter(({ fileName }) => !initialFileNames.has(fileName))
  if (asyncJavaScript.length === 0) throw new Error('No async JavaScript assets found')

  return {
    javascriptBytes: sum(javascript, 'bytes'),
    javascriptGzipBytes: sum(javascript, 'gzipBytes'),
    largestJavaScriptBytes: largest(javascript, 'bytes'),
    largestJavaScriptGzipBytes: largest(javascript, 'gzipBytes'),
    initialJavaScriptBytes: sum(initialJavaScript, 'bytes'),
    initialJavaScriptGzipBytes: sum(initialJavaScript, 'gzipBytes'),
    largestAsyncJavaScriptBytes: largest(asyncJavaScript, 'bytes'),
    largestAsyncJavaScriptGzipBytes: largest(asyncJavaScript, 'gzipBytes'),
    cssBytes: sum(css, 'bytes'),
    cssGzipBytes: sum(css, 'gzipBytes'),
  }
}

export function parseBundleBudgetConfig(value: unknown): BundleBudgetConfig {
  if (typeof value !== 'object' || value === null)
    throw new Error('Bundle budget must be an object')
  const candidate = value as Partial<BundleBudgetConfig>
  if (typeof candidate.rationale !== 'string' || candidate.rationale.trim().length === 0) {
    throw new Error('Bundle budget rationale is required')
  }

  for (const group of ['baseline', 'maximum'] as const) {
    const metrics = candidate[group]
    if (typeof metrics !== 'object' || metrics === null) {
      throw new Error(`Bundle budget ${group} is required`)
    }
    for (const metric of BUNDLE_METRIC_NAMES) {
      const amount = metrics[metric]
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error(`Bundle budget ${group}.${metric} must be a positive integer`)
      }
    }
  }

  const baseline = candidate.baseline as BundleMetrics
  const maximum = candidate.maximum as BundleMetrics
  for (const metric of BUNDLE_METRIC_NAMES) {
    if (maximum[metric] < baseline[metric]) {
      throw new Error(`Bundle maximum ${metric} cannot be below its measured baseline`)
    }
  }

  const incrementalMaximum: Partial<BundleMetrics> = {}
  if (candidate.incrementalMaximum !== undefined) {
    if (typeof candidate.incrementalMaximum !== 'object' || candidate.incrementalMaximum === null) {
      throw new Error('Bundle budget incrementalMaximum must be an object')
    }
    for (const metric of BUNDLE_METRIC_NAMES) {
      const amount = candidate.incrementalMaximum[metric]
      if (amount === undefined) continue
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error(`Bundle budget incrementalMaximum.${metric} must be a positive integer`)
      }
      incrementalMaximum[metric] = amount
    }
  }

  return { rationale: candidate.rationale, baseline, maximum, incrementalMaximum }
}

export function getEffectiveBundleMaximum(
  metric: BundleMetricName,
  config: BundleBudgetConfig,
): number {
  const incrementalMaximum = config.incrementalMaximum[metric]
  return incrementalMaximum === undefined
    ? config.maximum[metric]
    : Math.min(config.maximum[metric], config.baseline[metric] + incrementalMaximum)
}

export function checkBundleBudget(
  actual: BundleMetrics,
  config: BundleBudgetConfig,
): BundleBudgetViolation[] {
  return BUNDLE_METRIC_NAMES.map((metric) => ({
    metric,
    actual: actual[metric],
    maximum: getEffectiveBundleMaximum(metric, config),
  })).filter(({ actual, maximum }) => actual > maximum)
}
