import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'

import {
  checkBundleBudget,
  measureClientBundle,
  parseBundleBudgetConfig,
  type BundleBudgetConfig,
} from './bundle-budget'

const temporaryDirectories: string[] = []

function createAssets(): { directory: string; javascript: Buffer[]; css: Buffer[] } {
  const root = mkdtempSync(join(tmpdir(), 'eurtisan-bundle-budget-'))
  temporaryDirectories.push(root)
  const directory = join(root, 'assets')
  mkdirSync(directory)

  const javascript = [
    Buffer.from('const __vite__mapDeps = []; const alpha = "a".repeat(20)'),
    Buffer.from('export default 42'),
  ]
  const css = [Buffer.from('body { color: black; }')]
  writeFileSync(join(directory, 'index-a.js'), javascript[0])
  writeFileSync(join(directory, 'lazy-b.js'), javascript[1])
  writeFileSync(join(directory, 'index-a.css'), css[0])

  return { directory, javascript, css }
}

function makeConfig(maximum = 10_000): BundleBudgetConfig {
  const metrics = {
    javascriptBytes: maximum,
    javascriptGzipBytes: maximum,
    largestJavaScriptBytes: maximum,
    largestJavaScriptGzipBytes: maximum,
    initialJavaScriptBytes: maximum,
    initialJavaScriptGzipBytes: maximum,
    largestAsyncJavaScriptBytes: maximum,
    largestAsyncJavaScriptGzipBytes: maximum,
    cssBytes: maximum,
    cssGzipBytes: maximum,
  }
  return {
    rationale: 'Measured fixture baseline.',
    baseline: { ...metrics },
    maximum: { ...metrics },
    incrementalMaximum: {},
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('bundle budget', () => {
  it('measures aggregate and largest raw/gzip assets deterministically', () => {
    const { directory, javascript, css } = createAssets()
    const result = measureClientBundle(directory)

    expect(result).toEqual({
      javascriptBytes: javascript.reduce((total, contents) => total + contents.length, 0),
      javascriptGzipBytes: javascript.reduce(
        (total, contents) => total + gzipSync(contents, { level: 9 }).length,
        0,
      ),
      largestJavaScriptBytes: Math.max(...javascript.map(({ length }) => length)),
      largestJavaScriptGzipBytes: Math.max(
        ...javascript.map((contents) => gzipSync(contents, { level: 9 }).length),
      ),
      initialJavaScriptBytes: javascript[0]?.length,
      initialJavaScriptGzipBytes: gzipSync(javascript[0] as Buffer, { level: 9 }).length,
      largestAsyncJavaScriptBytes: javascript[1]?.length,
      largestAsyncJavaScriptGzipBytes: gzipSync(javascript[1] as Buffer, { level: 9 }).length,
      cssBytes: css[0]?.length,
      cssGzipBytes: gzipSync(css[0] as Buffer, { level: 9 }).length,
    })
  })

  it('reports only metrics above their reviewable maximum', () => {
    const config = makeConfig(100)
    const actual = { ...config.maximum, javascriptBytes: 101, cssGzipBytes: 102 }

    expect(checkBundleBudget(actual, config)).toEqual([
      { metric: 'javascriptBytes', actual: 101, maximum: 100 },
      { metric: 'cssGzipBytes', actual: 102, maximum: 100 },
    ])
  })

  it('uses the tighter incremental or global limit', () => {
    const config = makeConfig(200)
    config.baseline.cssBytes = 100
    config.incrementalMaximum.cssBytes = 20

    expect(checkBundleBudget({ ...config.maximum, cssBytes: 121 }, config)).toEqual([
      { metric: 'cssBytes', actual: 121, maximum: 120 },
    ])
  })

  it('rejects incomplete or unjustified budget configuration', () => {
    expect(() => parseBundleBudgetConfig({ baseline: {}, maximum: {} })).toThrow(
      'rationale is required',
    )
    expect(() =>
      parseBundleBudgetConfig({
        ...makeConfig(),
        maximum: { ...makeConfig().maximum, javascriptBytes: 0 },
      }),
    ).toThrow('maximum.javascriptBytes must be a positive integer')
    expect(() =>
      parseBundleBudgetConfig({
        ...makeConfig(),
        incrementalMaximum: { cssBytes: 0 },
      }),
    ).toThrow('incrementalMaximum.cssBytes must be a positive integer')
  })
})
