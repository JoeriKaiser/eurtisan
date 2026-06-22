import { test, expect } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { createTestCustomer } from './fixtures/orders'
import { db } from './db'
import { user } from '../src/db/schema'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Account deletion and erasure', () => {
  test('anonymizes a customer account and blocks re-authentication', async ({ page, context }) => {
    const customer = await createTestCustomer(`delete-${Date.now()}`)

    // Sign in via API and apply the session cookie to the test context.
    const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer.email, password: customer.password }),
    })
    expect(response.ok).toBeTruthy()

    const setCookie = response.headers.get('set-cookie')
    if (!setCookie) throw new Error('No set-cookie header returned from sign-in')
    const sessionCookie = setCookie.split(';')[0]
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

    await page.goto('/account/settings')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByLabel(/type your email to confirm/i).fill(customer.email)
    await page.getByRole('button', { name: /delete account permanently/i }).click()

    await page.waitForURL('/')
    await expect(page.getByText(/your account has been deleted/i)).toBeVisible()

    // Verify the user row has been anonymized.
    const [userRow] = await db
      .select({ email: user.email, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, customer.id))
      .limit(1)
    expect(userRow?.deletedAt).toBeTruthy()
    expect(userRow?.email).not.toBe(customer.email)
    expect(userRow?.email).toContain('anonymized')

    // Re-authentication must fail for the deleted account.
    const reauth = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer.email, password: customer.password }),
    })
    expect(reauth.ok).toBeFalsy()
  })
})
