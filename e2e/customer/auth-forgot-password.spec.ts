import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'
import { createVerifiedCustomer, deleteCustomerByEmail } from '../fixtures/customers'
import { clearInboxFor, getLatestEmail, isMailpitAvailable } from '../fixtures/email'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Customer forgot password', () => {
  const seed = `forgot-${Date.now()}`
  let customer: Awaited<ReturnType<typeof createVerifiedCustomer>>

  test.beforeAll(async () => {
    test.skip(!(await isMailpitAvailable()), 'Mailpit is not available')
    customer = await createVerifiedCustomer(seed)
    await clearInboxFor(customer.email)
  })

  test.afterAll(async () => {
    await deleteCustomerByEmail(customer.email)
  })

  test('requests a password reset link and observes cooldown', async ({ page }) => {
    await page.goto('/forgot-password')
    await waitForAppHydration(page)

    await page.fill('#email', customer.email)
    await page.getByRole('button', { name: /send reset link/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 })

    const message = await getLatestEmail(customer.email, /reset/i)
    expect(message.Subject.toLowerCase()).toContain('reset')

    // Cooldown should disable resend and show remaining seconds.
    const resendButton = page.getByRole('button', { name: /resend/i })
    await expect(resendButton).toBeDisabled()
  })
})
