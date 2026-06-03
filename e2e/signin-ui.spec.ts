import { test, expect } from '@playwright/test'
import { E2E_CUSTOMER } from './fixtures/auth'

test.describe('Sign-in UI', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('customer can sign in through the sign-in page', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.fill('#email', E2E_CUSTOMER.email)
    await page.fill('#password', E2E_CUSTOMER.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL('/', { timeout: 15_000 })
    await expect(page.getByText(E2E_CUSTOMER.displayName)).toBeVisible({ timeout: 10_000 })
  })
})
