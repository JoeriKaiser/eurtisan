import { test, expect } from '@playwright/test'
import { deleteCustomerByEmail } from '../fixtures/customers'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import {
  clearInboxFor,
  extractVerificationToken,
  getLatestEmail,
  isMailpitAvailable,
} from '../fixtures/email'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Customer verify email', () => {
  const seed = `verify-${Date.now()}`
  const email = `e2e-${seed}@eurtisan.local`
  const name = `E2E Customer ${seed}`
  const password = 'TestPassword123!'

  test.beforeAll(async () => {
    test.skip(!(await isMailpitAvailable()), 'Mailpit is not available')
  })

  test.afterAll(async () => {
    await deleteCustomerByEmail(email)
  })

  test('verifies email with token from Mailpit and resends on request', async ({ page }) => {
    await clearInboxFor(email)

    // Sign up to generate a verification email.
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    await page.getByRole('button', { name: /sign up/i }).click()
    await page.fill('#name', name)
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.fill('#confirmPassword', password)
    await page.getByRole('button', { name: /^create account$/i }).click()

    await expect(page).toHaveURL(/\/verify-email/)

    const message = await getLatestEmail(email, /verify/i)
    const token = extractVerificationToken(message)

    // The user is already a guest after sign-up because /verify-email is guest-only.
    await page.goto(`/verify-email?token=${token}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByText(/email verified/i)).toBeVisible({ timeout: 10000 })

    // Verification signs the user in (autoSignInAfterVerification), so sign
    // out before testing the guest-only resend flow.
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.getByRole('button', { name: /open user menu/i }).click()
    await page.getByRole('menuitem', { name: /sign out/i }).click()

    // Resend flow from the "check your inbox" screen (guest context).
    await page.goto(`/verify-email?email=${encodeURIComponent(email)}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('button', { name: /resend/i }).click()
    await expect(page.getByText(/verification email resent successfully/i)).toBeVisible({
      timeout: 10000,
    })
  })
})
