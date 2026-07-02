import { expect, test } from '@playwright/test'
import { E2E_CUSTOMER } from '../fixtures/auth'
import {
  createVerifiedCustomer,
  deleteCustomerByEmail,
  markCustomerDeleted,
} from '../fixtures/customers'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Customer sign-in negative paths', () => {
  test('shows an error for an incorrect password', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill(E2E_CUSTOMER.email)
    await page.locator('[id="password"]').fill('wrong-password-123')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/signin/)
  })

  test('shows an error for a non-existent email', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill('does-not-exist@eurtisan.local')
    await page.locator('[id="password"]').fill('any-password-123')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/signin/)
  })

  test('blocks sign-in for a deleted account', async ({ page }) => {
    const customer = await createVerifiedCustomer(`deleted-signin-${Date.now()}`)
    try {
      await markCustomerDeleted(customer.email)

      await page.goto('/signin')
      await page.waitForSelector('html[data-hydrated="true"]')

      await page.locator('[id="email"]').fill(customer.email)
      await page.locator('[id="password"]').fill(customer.password)
      await page.getByRole('button', { name: /^sign in$/i }).click()

      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page).toHaveURL(/\/signin/)
    } finally {
      await deleteCustomerByEmail(customer.email)
    }
  })
})
