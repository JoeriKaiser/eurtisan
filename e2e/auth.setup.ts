import { existsSync, statSync } from 'node:fs'
import { E2E_CREATOR } from './fixtures/auth'
import { dismissAnalyticsConsentBanner } from './fixtures/consent'
import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/creator.json'
const baseURL = process.env.BASE_URL || 'http://localhost:3000'

function isAuthFileFresh(path: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!existsSync(path)) return false
  try {
    return Date.now() - statSync(path).mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

setup('authenticate as creator', async ({ page }) => {
  if (isAuthFileFresh(authFile)) {
    setup.skip()
    return
  }

  // Sign in via Better Auth API using native fetch to avoid Playwright/Bun compat issues
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: E2E_CREATOR.email,
      password: E2E_CREATOR.password,
    }),
  })

  expect(response.ok).toBeTruthy()

  // Extract and parse the session cookie from the response
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header returned from sign-in')

  const sessionCookie = setCookie.split(';')[0]
  const [cookieName, cookieValue] = sessionCookie.split('=')

  // Set the cookie in the browser context before navigating
  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    },
  ])

  // Set desktop viewport size to ensure header user name is visible
  await page.setViewportSize({ width: 1440, height: 900 })

  // Listen for console logs and errors from the browser page
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

  // Navigate to home page with the authenticated context
  await page.goto('/')
  await page.waitForSelector('html[data-hydrated="true"]')

  // Dismiss the analytics consent banner so it does not block later tests.
  await dismissAnalyticsConsentBanner(page)

  // Verify logged-in state by checking for the known creator name in the header
  await expect(page.getByText(E2E_CREATOR.displayName)).toBeVisible()

  await page.context().storageState({ path: authFile })
})
