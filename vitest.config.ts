import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    fileParallelism: false,
  },
})
