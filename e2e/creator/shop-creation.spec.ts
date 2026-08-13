import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { createAdminContext } from '../fixtures/admin'

const E2E_SHOP_NAME = 'Playwright Test Shop'

test.setTimeout(180000)

function useE2eDatabase() {
  process.env.DATABASE_URL =
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://eurtisan:eurtisan@db:5432/eurtisan'
}

test.describe('shop creation onboarding', () => {
  let dummyPngPath: string

  test.beforeAll(async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dummyDir = path.join(__dirname, '../fixtures')
    if (!fs.existsSync(dummyDir)) fs.mkdirSync(dummyDir, { recursive: true })
    dummyPngPath = path.join(dummyDir, 'dummy.png')
    const base64Png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    fs.writeFileSync(dummyPngPath, Buffer.from(base64Png, 'base64'))
  })

  test.afterAll(async () => {
    useE2eDatabase()
    const { db } = await import('../../src/db/index')
    const { shop } = await import('../../src/db/schema')
    await db.delete(shop).where(eq(shop.name, E2E_SHOP_NAME))
  })

  test('creator builds a valid shop and its first product becomes public at go-live', async ({
    page,
    browser,
  }) => {
    await page.goto('/sell')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()
    await page.getByRole('button', { name: 'Create a shop' }).click()

    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /build your shop profile/i })).toBeVisible()

    await page.fill('#shop-name', E2E_SHOP_NAME)
    await expect(page.locator('#shop-slug')).toHaveValue('playwright-test-shop')
    await expect(page.getByText('Available')).toBeVisible()
    await page.fill('#shop-tagline', 'Handcrafted goods for E2E testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByLabel('Handmade by me').check()
    await page.fill(
      '#shop-description',
      'We create beautiful handcrafted ceramics using traditional European techniques in our small independent workshop.',
    )
    await page.setInputFiles('input[type="file"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /remove shop icon/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/location/)
    await expect(page.getByRole('heading', { name: /verify your seller details/i })).toBeVisible()

    await page.selectOption('#dispatch-country', 'FR')
    await page.fill('#dispatch-city', 'Lyon')
    await page.fill('#dispatch-postal', '69001')
    await page.fill('#business-street', '4 Rue Mercière')
    await page.fill('#business-city', 'Lyon')
    await page.fill('#business-postal', '69001')
    await page.selectOption('#business-country', 'FR')
    await page.getByRole('radio', { name: /^I am a trader/ }).check()
    await page.fill('#tax-id', 'FRTIN123456')
    await page.fill('#date-of-birth', '1990-01-01')

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/listing/)
    await expect(page.getByRole('heading', { name: /create your first product/i })).toBeVisible()

    await page.fill('#listing-name', 'E2E Creator Onboarding Item')
    await page.fill(
      '#listing-description',
      'A beautiful handcrafted ceramic piece made with traditional European workshop techniques.',
    )
    await page.selectOption('#listing-category', { index: 1 })
    await page.setInputFiles('input[type="file"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /remove product image 1/i })).toBeVisible({
      timeout: 15000,
    })
    await page.fill('#listing-price', '49.99')
    await page.fill('#listing-stock', '10')
    await page.fill('#listing-weight', '600')
    await page.fill('#listing-length', '20')
    await page.fill('#listing-width', '20')
    await page.fill('#listing-height', '12')

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/policies/)
    await expect(
      page.getByRole('heading', { name: /set delivery and shop policies/i }),
    ).toBeVisible()
    await page.getByLabel(/i understand that my shop policies/i).check()

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/review/)
    await expect(page.getByRole('heading', { name: /preview and submit/i })).toBeVisible()
    useE2eDatabase()
    const reviewShopId = new URL(page.url()).pathname.split('/')[3]
    const { db } = await import('../../src/db/index')
    const { product, shop, user } = await import('../../src/db/schema')
    const { getOnboardingReadinessInternal } = await import('../../src/lib/shops/onboarding.server')
    const readiness = await getOnboardingReadinessInternal(reviewShopId)
    expect(readiness.items, JSON.stringify(readiness.items)).toEqual([
      { id: 'profile', path: 'identity', complete: true },
      { id: 'seller', path: 'location', complete: true },
      { id: 'product', path: 'listing', complete: true },
      { id: 'delivery', path: 'policies', complete: true },
    ])
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Ready to submit')).toBeVisible()
    await page.getByLabel(/i agree to the seller terms/i).check()
    await page.getByRole('button', { name: /submit shop for review/i }).click()

    await page.waitForURL(/\/sell\/status\/[^/]+/)
    await expect(page.getByRole('heading', { name: /your shop is under review/i })).toBeVisible()
    const shopId = new URL(page.url()).pathname.split('/').pop()
    expect(shopId).toMatch(/^[0-9a-f-]+$/)
    if (!shopId) throw new Error('Submitted shop id was missing from the status URL')

    const adminContext = await createAdminContext(browser)
    const adminPage = await adminContext.newPage()
    await adminPage.goto('/admin/shops?view=applications')
    await waitForAppHydration(adminPage)
    await adminPage
      .locator('tr')
      .filter({ hasText: E2E_SHOP_NAME })
      .getByRole('button', { name: 'Review Application' })
      .click()
    await expect(adminPage.getByRole('dialog')).toBeVisible()
    await adminPage.getByRole('button', { name: 'Approve Shop' }).click()
    await expect(adminPage.getByRole('dialog')).not.toBeVisible()
    await adminContext.close()

    const [approvedShop] = await db.select().from(shop).where(eq(shop.id, shopId))
    await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, approvedShop.ownerId))
    await page.reload()
    await expect(page.getByRole('heading', { name: /your shop is approved/i })).toBeVisible()
    await expect(page.getByText(/publish the approved first product/i)).not.toHaveClass(
      /line-through/,
    )
    await expect(page.getByRole('link', { name: 'Enable 2FA' })).toBeVisible()

    useE2eDatabase()
    await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, approvedShop.ownerId))
    await db.update(shop).set({ paymentConnected: true }).where(eq(shop.id, shopId))
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Publish and go live' }).click()
    await expect(page.getByRole('heading', { name: /your shop is live/i })).toBeVisible()

    const [liveShop] = await db.select().from(shop).where(eq(shop.id, shopId))
    if (!liveShop.onboardingListingId) throw new Error('Live shop has no onboarding listing')
    const [liveProduct] = await db
      .select()
      .from(product)
      .where(eq(product.id, liveShop.onboardingListingId))
    expect(liveShop.status).toBe('active')
    expect(liveProduct.status).toBe('published')
    expect(liveProduct.isActive).toBe(true)

    const anonymousContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
    const anonymousPage = await anonymousContext.newPage()
    await anonymousPage.goto(`/shops/${liveShop.slug}/products/${liveProduct.slug}`)
    await expect(anonymousPage.getByRole('heading', { name: liveProduct.name })).toBeVisible()
    await anonymousContext.close()
  })
})
