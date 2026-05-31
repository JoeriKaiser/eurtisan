import { defineProject } from 'vitest/config'

export default defineProject({
  resolve: { tsconfigPaths: true },
  server: {
    port: 0,
  },
  test: {
    name: 'unit',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup-unit.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'e2e', 'dist'],
    pool: 'forks',
    fileParallelism: false,
    execArgv: [],
  },
})
