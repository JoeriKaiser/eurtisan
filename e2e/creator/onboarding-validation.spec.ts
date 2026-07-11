import { expect, type Page, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { shop, user } from '../../src/db/schema'
import { db } from '../db'
import { createVerifiedCreator, deleteCreatorByEmail, type TestCreator } from '../fixtures/creators'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 1440, height: 900 },
})

test.describe('creator onboarding validation and draft persistence', () => {
  const createdCreators: TestCreator[] = []
  let seededShopSlug: string
  let seededShopName: string

  test.beforeAll(async () => {
    // Ensure direct DB queries target the isolated E2E database.
    process.env.DATABASE_URL =
      process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'

    const [row] = await db
      .select({ name: shop.name, slug: shop.slug })
      .from(shop)
      .innerJoin(user, eq(shop.ownerId, user.id))
      .where(eq(user.email, 'creator@eurtisan.local'))
      .limit(1)

    seededShopSlug = row?.slug ?? 'the-forge'
    seededShopName = row?.name ?? 'The Forge'
  })

  test.afterAll(async () => {
    for (const creator of createdCreators) {
      await deleteCreatorByEmail(creator.email)
    }
  })

  async function signInAsCreator(page: Page, creator: TestCreator): Promise<void> {
    const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: creator.email,
        password: creator.password,
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
        expires: Math.floor(Date.now() / 1000) + 3600 * 24,
      },
    ])

    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.evaluate(
      (key: string) => window.localStorage.setItem(key, 'denied'),
      'eurtisan_analytics_consent',
    )
    await page.reload()
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByText(creator.name)).toBeVisible()
  }

  async function startOnboarding(page: Page): Promise<string> {
    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()

    await page.getByRole('button', { name: 'Open a New Shop' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /start with the basics/i })).toBeVisible()

    const url = new URL(page.url())
    // /sell/onboarding/<draftId>/identity
    return url.pathname.split('/')[3]
  }

  test('shows validation errors for invalid shop name and slug', async ({ page }) => {
    const creator = await createVerifiedCreator(`onboarding-validation-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)

    await startOnboarding(page)

    // Shop name too short
    await page.fill('#shop-name', 'AB')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('#name-error')).toBeVisible()
    await expect(page.locator('#name-error')).toContainText('at least 4 characters')

    // Shop name with invalid characters
    await page.fill('#shop-name', 'Shop@Name!')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('#name-error')).toBeVisible()
    await expect(page.locator('#name-error')).toContainText(
      'Only letters, numbers, spaces, and hyphens',
    )

    // Valid name, but slug with invalid characters
    await page.fill('#shop-name', 'Valid Shop Name')
    await page.fill('#shop-slug', 'My_Shop!')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('#slug-error')).toBeVisible()
    await expect(page.locator('#slug-error')).toContainText(
      'Only lowercase letters, numbers, and hyphens',
    )
  })

  test('checks slug and shop name availability', async ({ page }) => {
    const creator = await createVerifiedCreator(`onboarding-availability-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)

    await startOnboarding(page)

    // Existing slug shows an availability error.
    await page.fill('#shop-slug', seededShopSlug)
    await expect(page.getByText('This URL is already taken. Try another')).toBeVisible({
      timeout: 10_000,
    })

    // Existing name shows a warning on blur.
    await page.fill('#shop-name', seededShopName)
    await page.locator('#shop-name').blur()
    await expect(page.getByText(/very close to an existing shop/)).toBeVisible({
      timeout: 10_000,
    })

    // A unique slug is reported as available.
    const uniqueSlug = `e2e-valid-slug-${Date.now()}`
    await page.fill('#shop-slug', uniqueSlug)
    await expect(page.getByText('Available')).toBeVisible({ timeout: 10_000 })
  })

  test('persists draft progress across steps and navigation', async ({ page }) => {
    const creator = await createVerifiedCreator(`onboarding-persist-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)

    const draftId = await startOnboarding(page)

    const shopName = `E2E Persist Shop ${Date.now()}`
    await page.fill('#shop-name', shopName)
    await page.fill('#shop-tagline', 'A tagline for persistence testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByRole('button', { name: 'Handmade by me' }).click()

    // Slug is auto-generated from the shop name.
    await expect(page.locator('#shop-slug')).not.toHaveValue('')

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/story/)
    await expect(page.getByRole('heading', { name: /tell your story/i })).toBeVisible()

    // Navigate away from the onboarding flow.
    await page.goto('/creator')
    await page.waitForSelector('html[data-hydrated="true"]')

    // Return to the Seller Hub and resume the saved draft.
    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()

    await expect(page.getByText('Draft')).toBeVisible()
    await expect(page.getByText('Step 1/8')).toBeVisible()
    await page.getByText('Continue Setup').click()

    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await expect(page.getByRole('heading', { name: /start with the basics/i })).toBeVisible()

    // Verify the same draft id was resumed and the previous values are still present.
    const resumedUrl = new URL(page.url())
    const resumedDraftId = resumedUrl.pathname.split('/')[3]
    expect(resumedDraftId).toBe(draftId)
    await expect(page.locator('#shop-name')).toHaveValue(shopName)
    await expect(page.locator('#shop-tagline')).toHaveValue('A tagline for persistence testing')
  })
})
