import { waitForAppHydration } from './fixtures/hydration'
import { existsSync, statSync } from 'node:fs'
import { expect, test as setup } from '@playwright/test'
import { E2E_ADMIN, loadAuthCookies } from './fixtures/auth'
import { dismissAnalyticsConsentBanner } from './fixtures/consent'

const authFile = 'e2e/.auth/admin.json'
const baseURL = process.env.BASE_URL || 'http://localhost:3000'

function isAuthFileFresh(path: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!existsSync(path)) return false
  try {
    return Date.now() - statSync(path).mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

setup('authenticate as admin', async ({ page }) => {
  let cookies = isAuthFileFresh(authFile) ? loadAuthCookies(authFile) : []

  // Re-authenticate through the API only when there is no fresh stored session.
  // When fresh state exists we reuse it so the post-auth landing page is still
  // rendered and the test-finished screenshot is not a blank page.
  if (cookies.length === 0) {
    const signInUrl = `${baseURL}/api/auth/sign-in/email`
    const response = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: E2E_ADMIN.email,
        password: E2E_ADMIN.password,
      }),
    })

    expect(response.ok).toBeTruthy()

    const setCookie = response.headers.get('set-cookie')
    if (!setCookie) throw new Error('No set-cookie header returned from admin sign-in')

    const sessionCookie = setCookie.split(';')[0]
    const eqIdx = sessionCookie.indexOf('=')

    const cookieName = sessionCookie.slice(0, eqIdx)

    const cookieValue = sessionCookie.slice(eqIdx + 1)

    cookies = [
      {
        name: cookieName,
        value: cookieValue,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
      },
    ]
  }

  await page.context().addCookies(cookies)

  await page.goto('/admin')
  await waitForAppHydration(page)

  await dismissAnalyticsConsentBanner(page)

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({
    timeout: 10000,
  })

  await page.context().storageState({ path: authFile })
})
