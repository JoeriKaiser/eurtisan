import { existsSync, statSync } from 'node:fs'
import { E2E_CUSTOMER } from './fixtures/auth'
import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/customer.json'
const baseURL = process.env.BASE_URL || 'http://localhost:3000'

function isAuthFileFresh(path: string, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!existsSync(path)) return false
  try {
    return Date.now() - statSync(path).mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

setup('authenticate as customer', async ({ page }) => {
  if (isAuthFileFresh(authFile)) {
    setup.skip()
    return
  }

  // Sign in via Better Auth API using native fetch to avoid Playwright/Bun compat issues
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: E2E_CUSTOMER.email,
      password: E2E_CUSTOMER.password,
    }),
  })

  expect(response.ok).toBeTruthy()

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header returned from sign-in')

  const sessionCookie = setCookie.split(';')[0]
  const [cookieName, cookieValue] = sessionCookie.split('=')

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

  await page.setViewportSize({ width: 1440, height: 900 })
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

  await page.goto('/')
  await page.waitForSelector('html[data-hydrated="true"]')
  await expect(page.getByText(E2E_CUSTOMER.displayName)).toBeVisible()

  await page.context().storageState({ path: authFile })
})
