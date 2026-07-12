import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: ['.env.local', '.env'] })

// Force Vitest unit/browser tests to always run against the development database
// to prevent them from wiping out the isolated E2E test database (db-test:5432).
process.env.DATABASE_URL = 'postgresql://eurtisan:eurtisan@db:5432/eurtisan'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 0,
  },
  test: {
    api: false,
    projects: ['./vitest.unit.config.ts', './vitest.browser.config.ts'],
  },
})
