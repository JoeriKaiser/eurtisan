import { defineProject } from 'vitest/config'
import { assertBrowserTestsDatabaseFree } from './scripts/vitest-test-classification'

assertBrowserTestsDatabaseFree()

export default defineProject({
  resolve: { tsconfigPaths: true },
  server: {
    port: 0,
  },
  test: {
    name: 'browser',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup-browser.ts'],
    include: ['src/**/*.test.tsx'],
    exclude: ['node_modules', 'e2e', 'dist'],
    pool: 'forks',
    fileParallelism: true,
    maxWorkers: process.env.VITEST_PARALLEL_WORKERS
      ? Number(process.env.VITEST_PARALLEL_WORKERS)
      : undefined,
  },
})
