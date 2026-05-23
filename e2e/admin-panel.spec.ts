import { test, expect } from '@playwright/test'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

/**
 * Sign in as admin via the Better Auth API and return session cookies.
 */
async function getAdminSessionCookies(): Promise<
  Array<{
    name: string
    value: string
    domain: string
    path: string
    httpOnly: boolean
    sameSite: 'Lax' | 'Strict' | 'None'
    expires: number
  }>
> {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@eurtisan.local',
      password: 'password',
    }),
  })

  if (!response.ok) {
    throw new Error(`Admin sign-in failed: ${response.status} ${response.statusText}`)
  }

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error('No set-cookie header in admin sign-in response')
  }

  const sessionCookie = setCookie.split(';')[0]
  const [cookieName, cookieValue] = sessionCookie.split('=')

  return [
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

test.describe('admin panel navigation', () => {
  test.use({ storageState: undefined })

  test('admin pages render with sidebar links', async ({ browser }) => {
    // Sign in once and reuse the context for all navigation
    const cookies = await getAdminSessionCookies()
    const context = await browser.newContext()
    await context.addCookies(cookies)
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })

    // 1. Dashboard — verify sidebar links exist
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('aside a[href="/admin/users"]')).toBeVisible()
    await expect(page.locator('aside a[href="/admin/categories"]')).toBeVisible()
    await expect(page.locator('aside a[href="/admin/products"]')).toBeVisible()

    // 2. Users page
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({
      timeout: 10000,
    })

    // 3. Categories page
    await page.goto('/admin/categories')
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10000 })

    // 4. Products page
    await page.goto('/admin/products')
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible({
      timeout: 10000,
    })

    await context.close()
  })
})
