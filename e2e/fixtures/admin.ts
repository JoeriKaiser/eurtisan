import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { E2E_ADMIN } from './auth'

export interface AdminCookie {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  sameSite: 'Strict' | 'Lax' | 'None' | undefined
  expires: number
}

/**
 * Authenticate as admin by calling the Better Auth email endpoint directly.
 * Returns cookie shape suitable for Playwright's addCookies().
 */
export async function authenticateAdmin(baseURL = 'http://localhost:3000'): Promise<AdminCookie[]> {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: E2E_ADMIN.email, password: E2E_ADMIN.password }),
  })
  expect(response.ok).toBeTruthy()

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header returned from admin sign-in')

  const sessionCookie = setCookie.split(';')[0]
  const [cookieName, cookieValue] = sessionCookie.split('=')

  return [
    {
      name: cookieName,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
      expires: Math.floor(Date.now() / 1000) + 3600 * 24,
    },
  ]
}

/**
 * Create an authenticated admin browser context.
 */
export async function createAdminContext(
  browser: { newContext: (opts?: object) => Promise<BrowserContext> },
  baseURL?: string,
) {
  const cookies = await authenticateAdmin(baseURL)
  const context = await browser.newContext()
  await context.addCookies(cookies)
  return context
}
