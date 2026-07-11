import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { createTestUser, deleteUserByEmail, markUserDeleted } from '../fixtures/admin'
import { E2E_ADMIN } from '../fixtures/auth'
import { createVerifiedCreator } from '../fixtures/creators'
import { createVerifiedCustomer } from '../fixtures/customers'

/**
 * Every test in this file starts with an empty browser context so we can
 * exercise the real sign-in flow. This overrides the `chromium-admin`
 * project storage state.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('admin authentication and access control', () => {
  const createdEmails: string[] = []

  test.afterAll(async () => {
    await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)))
  })

  test('admin can sign in and reach the dashboard', async ({ page }) => {
    await page.goto('/signin?redirect=/admin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill(E2E_ADMIN.email)
    await page.locator('[id="password"]').fill(E2E_ADMIN.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10000 })
  })

  test('non-admin customer is redirected to forbidden', async ({ page }) => {
    const seed = `forbidden-customer-${Date.now()}`
    const customer = await createVerifiedCustomer(seed)
    createdEmails.push(customer.email)

    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill(customer.email)
    await page.locator('[id="password"]').fill(customer.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page).toHaveURL(/\/\/?$/)

    await page.goto('/admin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page).toHaveURL(/\/forbidden/)
    await expect(page.getByRole('heading', { name: /Access Denied/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('non-admin creator is redirected to forbidden', async ({ page }) => {
    const seed = `forbidden-creator-${Date.now()}`
    const creator = await createVerifiedCreator(seed)
    createdEmails.push(creator.email)

    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill(creator.email)
    await page.locator('[id="password"]').fill(creator.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page).toHaveURL(/\/\/?$/)

    await page.goto('/admin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page).toHaveURL(/\/forbidden/)
    await expect(page.getByRole('heading', { name: /Access Denied/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('unauthenticated user is redirected to signin', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page).toHaveURL(/\/signin/)
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  })

  test('deleted admin account cannot sign in', async ({ page }) => {
    const seed = `deleted-admin-${Date.now()}`
    const admin = await createTestUser(seed, 'admin')
    createdEmails.push(admin.email)

    // Disable 2FA so the UI stays on the sign-in form and surfaces the
    // deleted-account error instead of redirecting to 2FA setup.
    await db
      .update(schema.user)
      .set({ twoFactorEnabled: false })
      .where(eq(schema.user.email, admin.email))

    // First verify the credentials are valid by signing in successfully.
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="email"]').fill(admin.email)
    await page.locator('[id="password"]').fill(admin.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/^(?!.*\/signin).+$/)
    await page.goto('/admin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible()

    // Now mark the account deleted and try to sign in again.
    await markUserDeleted(admin.email)

    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="email"]').fill(admin.email)
    await page.locator('[id="password"]').fill(admin.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/account has been deactivated/i)).toBeVisible()
    await expect(page).toHaveURL(/\/signin/)
  })
})
