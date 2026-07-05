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

test.describe('Customer sign-up', () => {
  const seed = `signup-${Date.now()}`
  const email = `e2e-${seed}@eurtisan.local`
  const name = `E2E Customer ${seed}`
  const password = 'TestPassword123!'

  test.afterAll(async () => {
    await deleteCustomerByEmail(email)
  })

  test('registers a new account and verifies email', async ({ page }) => {
    test.skip(!(await isMailpitAvailable()), 'Mailpit is not available')
    await clearInboxFor(email)

    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    // Toggle to sign-up mode.
    await page.getByRole('button', { name: /sign up/i }).click()

    await page.fill('#name', name)
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.fill('#confirmPassword', password)

    await page.getByRole('button', { name: /^create account$/i }).click()

    await expect(page).toHaveURL(/\/verify-email/)
    await expect(page.getByText(/check your inbox/i)).toBeVisible()

    // Extract verification token from Mailpit and complete verification.
    // The user is already a guest after sign-up because /verify-email is guest-only.
    const message = await getLatestEmail(email, /verify/i)
    const token = extractVerificationToken(message)

    await page.goto(`/verify-email?token=${token}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByText(/email verified/i)).toBeVisible({ timeout: 10000 })
  })

  test('shows error for mismatched passwords', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('button', { name: /sign up/i }).click()

    await page.fill('#name', name)
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.fill('#confirmPassword', 'different-password')

    await page.getByRole('button', { name: /^create account$/i }).click()

    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })
})
