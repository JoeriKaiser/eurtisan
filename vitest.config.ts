import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: ['.env.local', '.env'], quiet: true })

// Force Vitest unit/browser tests to always run against the development database
// to prevent them from wiping out the isolated E2E test database (db-test:5432).
process.env.DATABASE_URL = 'postgresql://eurtisan:eurtisan@db:5432/eurtisan'
// Synthetic test-only configuration prevents expected fallback warnings from hiding regressions.
process.env.DATABASE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
process.env.SENDCLOUD_FORCE_UNSTAMPED_LETTER = 'false'

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
