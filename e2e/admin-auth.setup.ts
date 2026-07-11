import { existsSync, statSync } from 'node:fs'
import { E2E_ADMIN, loadAuthCookies } from './fixtures/auth'
import { dismissAnalyticsConsentBanner } from './fixtures/consent'
import { test as setup, expect } from '@playwright/test'

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
  // Listen for console logs and errors from the browser page
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

  let cookies = isAuthFileFresh(authFile) ? loadAuthCookies(authFile) : []

  // Re-authenticate through the API only when there is no fresh stored session.
  // When fresh state exists we reuse it so the post-auth landing page is still
  // rendered and the test-finished screenshot is not a blank page.
  if (cookies.length === 0) {
    const signInUrl = `${baseURL}/api/auth/sign-in/email`
    console.log('Sending sign-in request to:', signInUrl)
    const response = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: E2E_ADMIN.email,
        password: E2E_ADMIN.password,
      }),
    })

    console.log('Sign-in Response status:', response.status)
    const responseBodyText = await response.text()
    console.log('Sign-in Response body:', responseBodyText)

    expect(response.ok).toBeTruthy()

    const setCookie = response.headers.get('set-cookie')
    console.log('Sign-in Set-Cookie header:', setCookie)
    if (!setCookie) throw new Error('No set-cookie header returned from admin sign-in')

    const sessionCookie = setCookie.split(';')[0]
    const eqIdx = sessionCookie.indexOf('=')

    const cookieName = sessionCookie.slice(0, eqIdx)

    const cookieValue = sessionCookie.slice(eqIdx + 1)
    console.log(`Setting cookie: ${cookieName} = ${cookieValue}`)

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
  console.log('Navigated to /admin. Current URL:', page.url())
  await page.waitForSelector('html[data-hydrated="true"]')
  console.log('Page hydrated. Current URL:', page.url())

  await dismissAnalyticsConsentBanner(page)

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({
    timeout: 10000,
  })

  await page.context().storageState({ path: authFile })
})
