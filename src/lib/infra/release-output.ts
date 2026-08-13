export type ReleaseOutputScope = 'build' | 'test'

export interface ReleaseOutputIssue {
  id: string
  message: string
}

const PROHIBITED_PATTERNS: Record<
  ReleaseOutputScope,
  ReadonlyArray<{
    id: string
    pattern: RegExp
    message: string
  }>
> = {
  build: [
    {
      id: 'route-generation-warning',
      pattern: /Warning: Route file .* does not export a Route/,
      message: 'TanStack route generation inspected a non-route file.',
    },
    {
      id: 'unbudgeted-large-chunk',
      pattern: /Some chunks are larger than .* after minification/,
      message: 'Vite emitted its unbudgeted large-chunk warning.',
    },
  ],
  test: [
    {
      id: 'react-act-warning',
      pattern: /was not wrapped in act\(\.\.\.\)/,
      message: 'React reported a state update outside act().',
    },
    {
      id: 'unsupported-browser-api',
      pattern: /Not implemented: (?:HTMLCanvasElement|navigation)/,
      message: 'JSDOM reported an unsupported browser API.',
    },
    {
      id: 'unrecognized-browser-element',
      pattern: /is unrecognized in this browser/,
      message: 'React reported an element unsupported by the test browser.',
    },
    {
      id: 'postgres-concurrent-query-deprecation',
      pattern:
        /Calling client\.query\(\) when the client is already executing a query is deprecated/,
      message: 'PostgreSQL client concurrency uses a deprecated query pattern.',
    },
  ],
}

export function scanReleaseOutput(output: string, scope: ReleaseOutputScope): ReleaseOutputIssue[] {
  return PROHIBITED_PATTERNS[scope]
    .filter(({ pattern }) => pattern.test(output))
    .map(({ id, message }) => ({ id, message }))
}
