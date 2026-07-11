import { expect, test } from '@playwright/test'
import { E2E_CREATOR } from '../fixtures/auth'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import {
  createVerifiedCreator,
  deleteCreatorByEmail,
  markCreatorDeleted,
} from '../fixtures/creators'
import type { TestCustomer } from '../fixtures/customers'
import { createVerifiedCustomer, deleteCustomerByEmail } from '../fixtures/customers'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('creator sign-in negative paths', () => {
  test('wrong password shows an error and stays on /signin', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill(E2E_CREATOR.email)
    await page.locator('[id="password"]').fill('wrong-password-123')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/signin/)
  })

  test('non-existent email shows an error and stays on /signin', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.locator('[id="email"]').fill('does-not-exist@eurtisan.local')
    await page.locator('[id="password"]').fill('any-password-123')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/signin/)
  })

  test('deleted creator account is blocked from signing in', async ({ page }) => {
    const creator = await createVerifiedCreator(`deleted-creator-${Date.now()}`)
    try {
      await markCreatorDeleted(creator.email)

      await page.goto('/signin')
      await page.waitForSelector('html[data-hydrated="true"]')

      await page.locator('[id="email"]').fill(creator.email)
      await page.locator('[id="password"]').fill(creator.password)
      await page.getByRole('button', { name: /^sign in$/i }).click()

      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page).toHaveURL(/\/signin/)
    } finally {
      await deleteCreatorByEmail(creator.email)
    }
  })
})

test.describe('become-creator flow', () => {
  let customer: TestCustomer | null = null

  test.afterAll(async () => {
    if (customer) {
      await deleteCustomerByEmail(customer.email)
    }
  })

  test('customer can start onboarding, save identity, and become a creator', async ({ page }) => {
    customer = await createVerifiedCustomer(`become-creator-${Date.now()}`)

    // Sign in as the fresh customer
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="email"]').fill(customer.email)
    await page.locator('[id="password"]').fill(customer.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    // Wait for post-sign-in navigation to settle
    await page.waitForURL(/^(?!.*\/signin).+$/)

    // Navigate to the seller hub as a customer
    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open a New Shop' })).toBeVisible()

    // Starting a new shop creates a draft, upgrades the customer role to creator,
    // and redirects to the onboarding identity step.
    await page.getByRole('button', { name: 'Open a New Shop' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /start with the basics/i })).toBeVisible()

    // Fill the identity step with a unique shop name and slug
    const seed = Date.now()
    const shopName = `E2E Become Creator ${seed}`
    const shopSlug = `e2e-become-creator-${seed}`
    await page.fill('#shop-name', shopName)
    await page.fill('#shop-slug', shopSlug)
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByRole('button', { name: 'Handmade by me' }).click({ force: true })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/story/)
    await expect(page.getByRole('heading', { name: /tell your story/i })).toBeVisible()

    // Reload to refresh the auth session and verify the upgraded role is reflected in the UI
    await page.reload()
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.getByRole('button', { name: 'Open user menu' }).click()
    await expect(page.getByRole('menuitem', { name: 'Creator Dashboard' })).toBeVisible()
  })
})
