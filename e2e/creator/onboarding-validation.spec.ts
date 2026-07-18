import { expect, type Page, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { shop, user } from '../../src/db/schema'
import { db } from '../db'
import { createVerifiedCreator, deleteCreatorByEmail, type TestCreator } from '../fixtures/creators'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })

test.describe('creator onboarding validation and draft persistence', () => {
  const createdCreators: TestCreator[] = []
  let seededShopSlug: string
  let seededShopName: string
  let dummyPngPath: string

  test.beforeAll(async () => {
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

    const fs = await import('node:fs')
    const path = await import('node:path')
    dummyPngPath = path.join(__dirname, '../fixtures/onboarding-validation.png')
    fs.writeFileSync(
      dummyPngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      ),
    )
  })

  test.afterAll(async () => {
    for (const creator of createdCreators) await deleteCreatorByEmail(creator.email)
  })

  async function signInAsCreator(page: Page, creator: TestCreator): Promise<void> {
    const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creator.email, password: creator.password }),
    })
    expect(response.ok).toBeTruthy()
    const setCookie = response.headers.get('set-cookie')
    if (!setCookie) throw new Error('No set-cookie header returned from sign-in')
    const [sessionCookie] = setCookie.split(';')
    const separator = sessionCookie.indexOf('=')
    await page.context().addCookies([
      {
        name: sessionCookie.slice(0, separator),
        value: sessionCookie.slice(separator + 1),
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 86400,
      },
    ])
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(creator.name)).toBeVisible()
  }

  async function startOnboarding(page: Page): Promise<string> {
    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create a shop' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /build your shop profile/i })).toBeVisible()
    return new URL(page.url()).pathname.split('/')[3]
  }

  test('shows inline errors and focuses the first invalid field', async ({ page }) => {
    const creator = await createVerifiedCreator(`onboarding-validation-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)
    await startOnboarding(page)

    await page.fill('#shop-name', 'AB')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('#shop-name-error')).toContainText('at least 4 characters')
    await expect(page.locator('#shop-name')).toBeFocused()

    await page.fill('#shop-name', 'Valid Shop Name')
    await page.fill('#shop-slug', 'ab')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('#shop-slug-error')).toContainText('at least 3 characters')
    await expect(page.locator('#shop-slug')).toBeFocused()
  })

  test('checks slug and shop-name availability', async ({ page }) => {
    const creator = await createVerifiedCreator(`onboarding-availability-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)
    await startOnboarding(page)

    await page.fill('#shop-slug', seededShopSlug)
    await expect(page.getByText('This shop URL is already in use. Choose another.')).toBeVisible({
      timeout: 10_000,
    })

    await page.fill('#shop-name', seededShopName)
    await page.locator('#shop-name').blur()
    await expect(page.getByText(/similar shop name already exists/i)).toBeVisible()

    await page.fill('#shop-slug', `e2e-valid-slug-${Date.now()}`)
    await expect(page.getByText('Available')).toBeVisible()
  })

  test('deletes an abandoned draft through an accessible confirmation', async ({ page }) => {
    const creator = await createVerifiedCreator(`onboarding-delete-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)
    const draftId = await startOnboarding(page)

    await page.goto('/sell')
    await page.waitForLoadState('networkidle')
    const card = page.locator('article').filter({ has: page.locator(`a[href*="${draftId}"]`) })
    await card.getByRole('button', { name: /delete draft/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Delete draft', exact: true }).click()
    await expect(page.locator(`a[href*="${draftId}"]`)).not.toBeVisible()
  })

  test('saves valid progress, exits, and resumes at the next stage without duplication', async ({
    page,
  }) => {
    const creator = await createVerifiedCreator(`onboarding-persist-${Date.now()}`)
    createdCreators.push(creator)
    await signInAsCreator(page, creator)
    const draftId = await startOnboarding(page)

    const shopName = `E2E Persist Shop ${Date.now()}`
    await page.fill('#shop-name', shopName)
    await page.fill('#shop-tagline', 'A tagline for persistence testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByLabel('Handmade by me').check()
    await page.fill(
      '#shop-description',
      'I make durable, carefully finished objects in a small European workshop using traditional methods.',
    )
    await page.setInputFiles('input[type="file"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /remove shop icon/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/location/)

    await page.goto('/sell')
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(page.getByText('Step 2 of 5')).toBeVisible()
    await page.getByRole('link', { name: 'Continue setup' }).click()

    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/location/)
    await page.waitForLoadState('networkidle')
    expect(new URL(page.url()).pathname.split('/')[3]).toBe(draftId)
    await page.getByRole('button', { name: 'Shop profile' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await expect(page.locator('#shop-name')).toHaveValue(shopName)
    await expect(page.locator('#shop-tagline')).toHaveValue('A tagline for persistence testing')
  })
})
