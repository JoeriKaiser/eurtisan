import { test, expect } from '@playwright/test'
import { E2E_CUSTOMER } from '../fixtures/auth'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Customer sign-out', () => {
  test('signs out and blocks protected routes', async ({ browser }) => {
    // Sign in fresh via API in an isolated context so the shared storage state
    // is not invalidated for subsequent tests.
    const signInResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: E2E_CUSTOMER.email,
        password: E2E_CUSTOMER.password,
      }),
    })
    expect(signInResponse.ok).toBeTruthy()

    const setCookie = signInResponse.headers.get('set-cookie')
    if (!setCookie) throw new Error('No set-cookie header returned from sign-in')

    const cookies = setCookie.split(',').map((cookie) => cookie.trim())
    const context = await browser.newContext()
    for (const cookie of cookies) {
      const cookiePart = cookie.split(';')[0]

      const eqIdx = cookiePart.indexOf('=')

      const name = cookiePart.slice(0, eqIdx)

      const value = cookiePart.slice(eqIdx + 1)
      await context.addCookies([
        {
          name,
          value,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
          expires: Math.floor(Date.now() / 1000) + 3600 * 24,
        },
      ])
    }

    const page = await context.newPage()
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    // Open user menu and sign out.
    await page.getByRole('button', { name: /customer user/i }).click()
    await page.getByRole('menuitem', { name: /sign out/i }).click()

    // After sign-out the header should show Sign in.
    await expect(page.getByRole('link', { name: /^sign in$/i })).toBeVisible({ timeout: 10000 })

    // Try to access a protected route in a fresh page (no storage state).
    const guestPage = await context.newPage()
    await guestPage.goto('/account/orders')
    await guestPage.waitForSelector('html[data-hydrated="true"]')

    await expect(guestPage).toHaveURL(/\/signin/)

    await context.close()
  })
})
