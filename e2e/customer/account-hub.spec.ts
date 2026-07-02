import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Account hub', () => {
  test('renders links to orders and settings', async ({ page }) => {
    await page.goto('/account')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /orders/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
  })
})
