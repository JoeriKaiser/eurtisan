import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './e2e/report', open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /\/auth\.setup\.ts$/,
    },
    {
      name: 'admin-setup',
      testMatch: /admin-auth\.setup\.ts/,
    },
    {
      name: 'customer-setup',
      testMatch: /customer-auth\.setup\.ts/,
    },
    {
      name: 'chromium-admin',
      testMatch: /e2e\/admin\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['admin-setup'],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/creator.json' },
      dependencies: ['setup', 'admin-setup', 'customer-setup'],
      testIgnore: [
        /signin-ui\.spec\.ts/,
        /account-deletion\.spec\.ts/,
        /customer\//,
        /creator\//,
        /admin\//,
      ],
    },
    {
      name: 'chromium-creator',
      testMatch: /creator\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/creator.json' },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-customer',
      testMatch: /customer\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/customer.json' },
      dependencies: ['customer-setup'],
    },
    {
      name: 'chromium-guest',
      testMatch: /signin-ui\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-no-auth',
      testMatch: /account-deletion\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'admin-setup', 'customer-setup'],
    },
  ],
})
