import { E2E_ADMIN } from './fixtures/auth'
import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/admin.json'
const baseURL = process.env.BASE_URL || 'http://localhost:3000'

setup('authenticate as admin', async ({ page }) => {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: E2E_ADMIN.email,
      password: E2E_ADMIN.password,
    }),
  })

  expect(response.ok).toBeTruthy()

  const setCookie = response.headers.get('set-cookie')
  expect(setCookie).toBeTruthy()

  const sessionCookie = setCookie!.split(';')[0]
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

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 10000 })

  await page.context().storageState({ path: authFile })
})
