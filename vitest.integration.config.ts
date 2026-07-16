import { defineProject } from 'vitest/config'
import { loadUnitTestClassification } from './scripts/vitest-test-classification'

const { database } = loadUnitTestClassification()

export default defineProject({
  resolve: { tsconfigPaths: true },
  server: {
    port: 0,
  },
  test: {
    name: 'unit-db',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup-unit.ts'],
    include: database,
    exclude: ['node_modules', 'e2e', 'dist'],
    pool: 'forks',
    fileParallelism: false,
    execArgv: [],
  },
})
