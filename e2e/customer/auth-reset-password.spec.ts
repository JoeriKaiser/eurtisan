import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'
import { createVerifiedCustomer, deleteCustomerByEmail } from '../fixtures/customers'
import {
  clearInboxFor,
  extractPasswordResetToken,
  getLatestEmail,
  isMailpitAvailable,
} from '../fixtures/email'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Customer reset password', () => {
  const seed = `reset-${Date.now()}`
  let customer: Awaited<ReturnType<typeof createVerifiedCustomer>>

  test.beforeAll(async () => {
    test.skip(!(await isMailpitAvailable()), 'Mailpit is not available')
    customer = await createVerifiedCustomer(seed)
  })

  test.afterAll(async () => {
    await deleteCustomerByEmail(customer.email)
  })

  test('shows error when token is missing', async ({ page }) => {
    await page.goto('/reset-password')
    await waitForAppHydration(page)

    await expect(page.getByText(/invalid.*token|token.*invalid/i)).toBeVisible()
  })

  test('resets password with token from forgot-password email', async ({ page }) => {
    await clearInboxFor(customer.email)

    // Request reset link.
    await page.goto('/forgot-password')
    await waitForAppHydration(page)
    await page.fill('#email', customer.email)
    await page.getByRole('button', { name: /send reset link/i }).click()
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 })

    const message = await getLatestEmail(customer.email, /reset/i)
    const token = extractPasswordResetToken(message)

    // Visit reset URL.
    await page.goto(`/reset-password?token=${token}`)
    await waitForAppHydration(page)

    const newPassword = 'NewPassword123!'
    await page.fill('#password', newPassword)
    await page.fill('#confirmPassword', newPassword)
    await page.getByRole('button', { name: /^reset password$/i }).click()

    await expect(page.getByText(/password.*reset/i)).toBeVisible({ timeout: 10000 })
  })
})
