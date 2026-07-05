import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/customer.json' })

test('locale direct nav', async ({ page }) => {
  await page.goto('/nl')
  await page.waitForSelector('html[data-hydrated="true"]')
  const localeButton = page.locator('header').getByRole('button', { name: /select language/i })
  await expect(localeButton).toHaveText(/nl/i)
})
