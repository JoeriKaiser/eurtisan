import { test, expect } from '@playwright/test'
import { createVerifiedCustomer, deleteCustomerByEmail } from '../fixtures/customers'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { generateTOTPCode } from '../fixtures/totp'

test.use({ storageState: { cookies: [], origins: [] } })

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Customer two-factor authentication', () => {
  const seed = `2fa-${Date.now()}`
  let customer: Awaited<ReturnType<typeof createVerifiedCustomer>>
  let totpUri: string

  test.beforeAll(async () => {
    customer = await createVerifiedCustomer(seed)
  })

  test.afterAll(async () => {
    await deleteCustomerByEmail(customer.email)
  })

  async function signInViaAPI(): Promise<string> {
    const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer.email, password: customer.password }),
    })
    expect(response.ok).toBeTruthy()
    const setCookie = response.headers.get('set-cookie')
    if (!setCookie) throw new Error('No set-cookie header')
    return setCookie.split(';')[0]
  }

  test('enables 2FA and requires TOTP on subsequent sign-in', async ({ page, context }) => {
    // Seed an authenticated browser context for the customer.
    const sessionCookie = await signInViaAPI()
    const [cookieName, cookieValue] = sessionCookie.split('=')
    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 3600 * 24,
      },
    ])

    // Enable 2FA.
    await page.goto('/account/security')
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    await page.locator('[id="2fa-password"]').fill(customer.password)
    await page.getByRole('button', { name: /enable two-factor/i }).click()

    await expect(page.getByText(/scan this uri/i)).toBeVisible({ timeout: 10000 })
    const uriText = await page.locator('p.font-mono').textContent()
    if (!uriText) throw new Error('TOTP URI not displayed')
    totpUri = uriText

    const code = generateTOTPCode(totpUri)
    await page.locator('[id="2fa-code"]').fill(code)
    await page.getByRole('button', { name: /confirm two-factor/i }).click()

    await expect(
      page.getByRole('status').filter({ hasText: /two-factor authentication is enabled/i }),
    ).toBeVisible({ timeout: 10000 })

    // Sign out.
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)
    await page.getByRole('button', { name: customer.name }).click()
    await page.getByRole('menuitem', { name: /sign out/i }).click()

    // Wait for the sign-out request to complete and the UI to reflect it.
    await expect(page.getByRole('link', { name: /^sign in$/i })).toBeVisible({ timeout: 10000 })

    // Sign in again — should now prompt for TOTP.
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="email"]').fill(customer.email)
    await page.locator('[id="password"]').fill(customer.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByLabel(/authenticator code/i)).toBeVisible({ timeout: 10000 })

    await page.locator('[id="two-factor-code"]').fill(generateTOTPCode(totpUri))
    await page.getByRole('button', { name: /verify and sign in/i }).click()

    await expect(page).toHaveURL('/', { timeout: 15000 })
  })
})
