import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { test, expect } from '@playwright/test'
import { createVerifiedCustomer, deleteCustomerByEmail } from '../fixtures/customers'
import { db } from '../db'
import * as schema from '../../src/db/schema'

test.describe('Unsubscribe', () => {
  const seed = `unsubscribe-${Date.now()}`
  let customer: Awaited<ReturnType<typeof createVerifiedCustomer>>
  let token: string

  test.beforeAll(async () => {
    customer = await createVerifiedCustomer(seed)
    token = randomBytes(32).toString('hex')

    process.env.DATABASE_URL =
      process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'
    await db.update(schema.user).set({ unsubscribeToken: token }).where(eq(schema.user.id, customer.id))
  })

  test.afterAll(async () => {
    await deleteCustomerByEmail(customer.email)
  })

  test('unsubscribes with a valid token', async ({ page }) => {
    await page.goto(`/unsubscribe?token=${token}&category=marketing`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /preferences updated/i })).toBeVisible()
    await expect(page.getByText(/unsubscribed/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /manage notification preferences/i })).toBeVisible()
  })

  test('shows error for an invalid token', async ({ page }) => {
    await page.goto('/unsubscribe?token=invalid-token')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /could not update preferences/i })).toBeVisible()
    await expect(page.getByText(/could not be updated/i)).toBeVisible()
  })
})
