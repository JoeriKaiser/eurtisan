import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: ['.env.local', '.env'], quiet: true })

// Force Vitest onto its own database, so a test run cannot wipe either of the
// two seeded ones. DB-backed tests call `clearTestTables()`, which truncates —
// pointed at `db:5432/eurtisan` it destroyed the development seed on every run,
// and pointed at `db-test:5432/eurtisan_test` it would destroy the E2E seed.
//
// Created and migrated by `make db-migrate-unit`, which `make test` depends on.
process.env.DATABASE_URL = 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_unit'
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
    projects: [
      './vitest.unit.config.ts',
      './vitest.integration.config.ts',
      './vitest.browser.config.ts',
    ],
  },
})
