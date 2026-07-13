import { describe, expect, it } from 'vitest'

import { scanReleaseOutput } from './release-output'

describe('scanReleaseOutput', () => {
  it('reports release-blocking test warnings once per category', () => {
    const issues = scanReleaseOutput(
      [
        'An update to ProductDetail inside a test was not wrapped in act(...).',
        'An update to ProductDetail inside a test was not wrapped in act(...).',
        "Not implemented: HTMLCanvasElement's getContext() method",
        'DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated',
      ].join('\n'),
      'test',
    )

    expect(issues.map(({ id }) => id)).toEqual([
      'react-act-warning',
      'unsupported-browser-api',
      'postgres-concurrent-query-deprecation',
    ])
  })

  it('reports route and unbudgeted chunk warnings from production builds', () => {
    const issues = scanReleaseOutput(
      [
        'Warning: Route file "/app/src/routes/example.test.ts" does not export a Route.',
        '(!) Some chunks are larger than 500 kB after minification.',
      ].join('\n'),
      'build',
    )

    expect(issues.map(({ id }) => id)).toEqual([
      'route-generation-warning',
      'unbudgeted-large-chunk',
    ])
  })

  it('allows expected application logs and the measured plugin timing diagnostic', () => {
    const issues = scanReleaseOutput(
      [
        '{"level":"warn","message":"expected failure-path log"}',
        '[PLUGIN_TIMINGS] Your build spent significant time in plugins.',
      ].join('\n'),
      'test',
    )

    expect(issues).toEqual([])
  })
})
