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
    await page.waitForLoadState('networkidle')

    await page.locator('[id="email"]').fill(E2E_CREATOR.email)
    await page.locator('[id="password"]').fill('wrong-password-123')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/signin/)
  })

  test('non-existent email shows an error and stays on /signin', async ({ page }) => {
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')

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
      await page.waitForLoadState('networkidle')

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

  test('customer can save a complete profile without premature creator promotion', async ({
    page,
  }) => {
    customer = await createVerifiedCustomer(`become-creator-${Date.now()}`)
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await page.locator('[id="email"]').fill(customer.email)
    await page.locator('[id="password"]').fill(customer.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/^(?!.*\/signin).+$/)

    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await dismissAnalyticsConsentBanner(page)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create a shop' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /build your shop profile/i })).toBeVisible()

    const fs = await import('node:fs')
    const path = await import('node:path')
    const imagePath = path.join(__dirname, '../fixtures/become-creator.png')
    fs.writeFileSync(
      imagePath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      ),
    )

    const seed = Date.now()
    await page.fill('#shop-name', `E2E Become Creator ${seed}`)
    await page.fill('#shop-slug', `e2e-become-creator-${seed}`)
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByLabel('Handmade by me').check()
    await page.fill(
      '#shop-description',
      'I create thoughtful handmade objects using traditional methods in my small European workshop.',
    )
    await page.setInputFiles('input[type="file"]', imagePath)
    await expect(page.getByRole('button', { name: /remove shop icon/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/location/)

    const { eq } = await import('drizzle-orm')
    const { db } = await import('../db')
    const { user } = await import('../../src/db/schema')
    const account = await db.query.user.findFirst({ where: eq(user.email, customer.email) })
    expect(account?.role).toBe('customer')

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Open user menu' }).click()
    await expect(page.getByRole('menuitem', { name: 'Creator Dashboard' })).not.toBeVisible()
  })
})
