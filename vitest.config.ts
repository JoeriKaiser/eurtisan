import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: ['.env.local', '.env'] })

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
