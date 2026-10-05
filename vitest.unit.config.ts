import { defineProject } from 'vitest/config'
import { loadUnitTestClassification } from './scripts/vitest-test-classification'

const { pure } = loadUnitTestClassification()

export default defineProject({
  resolve: { tsconfigPaths: true },
  server: {
    port: 0,
  },
  test: {
    name: 'unit-pure',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup-unit.ts'],
    include: pure,
    exclude: ['node_modules', 'e2e', 'dist'],
    pool: 'forks',
    fileParallelism: true,
    maxWorkers: process.env.VITEST_PARALLEL_WORKERS
      ? Number(process.env.VITEST_PARALLEL_WORKERS)
      : undefined,
    execArgv: [],
  },
})
