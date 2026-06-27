import { test, expect } from '@playwright/test'
import { eq } from 'drizzle-orm'

const E2E_SHOP_NAME = 'Playwright Test Shop'

test.describe('shop creation onboarding', () => {
  let dummyPngPath: string

  test.beforeAll(async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dummyDir = path.join(__dirname, 'fixtures')
    if (!fs.existsSync(dummyDir)) {
      fs.mkdirSync(dummyDir, { recursive: true })
    }
    dummyPngPath = path.join(dummyDir, 'dummy.png')
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    fs.writeFileSync(dummyPngPath, Buffer.from(base64Png, 'base64'))
  })

  test.afterAll(async () => {
    const connectionString =
      process.env.E2E_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://eurtisan:eurtisan@db:5432/eurtisan'
    process.env.DATABASE_URL = connectionString

    const { db } = await import('../src/db/index')
    const { shop } = await import('../src/db/schema')
    await db.delete(shop).where(eq(shop.name, E2E_SHOP_NAME))
  })

  test('creator can complete full onboarding, submit, and admin can approve', async ({ page, browser }) => {
    page.on('console', (msg) => console.log('SHOP CREATION PAGE LOG:', msg.text()))
    page.on('pageerror', (err) => console.error('SHOP CREATION PAGE ERROR:', err.message))

    // 1. Navigate to Seller Hub and wait for hydration
    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()

    // 2. Start a new shop — bypass the confirmation dialog (seeded creator already has 6 shops)
    await page.evaluate(() => {
      window.confirm = () => true
    })
    await page.getByRole('button', { name: 'Open a New Shop' }).click()

    // 3. Wait for redirect to onboarding step 1 (identity)
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /start with the basics/i })).toBeVisible()

    // 4. Fill out step 1: Identity
    await page.fill('#shop-name', E2E_SHOP_NAME)
    // Slug should auto-populate from name; wait for it
    await expect(page.locator('#shop-slug')).not.toHaveValue('')
    await page.fill('#shop-tagline', 'Handcrafted goods for E2E testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByRole('button', { name: 'Handmade by me' }).click()

    // 5. Continue to step 2: Story
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/story/)
    await expect(page.getByRole('heading', { name: /tell your story/i })).toBeVisible()

    // 6. Fill out step 2: Story
    await page.fill(
      '#shop-description',
      'We create beautiful handcrafted ceramics using traditional European techniques.',
    )
    await page.fill('#shop-tags', 'pottery')
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('pottery')).toBeVisible()

    await page.fill('#shop-languages', 'English')
    await page.getByRole('button', { name: 'Add' }).nth(1).click()
    await expect(page.getByText('English')).toBeVisible()

    // 7. Continue to step 3: Visuals
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/visuals/)
    await expect(page.getByRole('heading', { name: /visual identity/i })).toBeVisible()

    // 8. Upload Shop icon
    await page.setInputFiles('input[id="upload-Shop icon"]', dummyPngPath)
    await expect(page.getByRole('button', { name: 'Remove image' })).toBeVisible({ timeout: 15000 })

    // 9. Continue to step 4: Location
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/location/)
    await expect(page.getByRole('heading', { name: /location & shipping/i })).toBeVisible()

    // 10. Fill step 4 Location fields
    await page.selectOption('#country', 'FR')
    await page.fill('#tax-id', 'FR123456789')
    await page.fill('#date-of-birth', '1990-01-01')

    // 11. Continue to step 5: Policies
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/policies/)
    await expect(page.getByRole('heading', { name: /shop policies/i })).toBeVisible()

    // 12. Continue to step 6: Socials
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/socials/)
    await expect(page.getByRole('heading', { name: /socials & links/i })).toBeVisible()

    // 13. Continue to step 7: Listing
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/listing/)
    await expect(page.getByRole('heading', { name: /your first listing/i })).toBeVisible()

    // 14. Upload product image & fill out fields
    await page.setInputFiles('input[type="file"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /remove image/i })).toBeVisible({ timeout: 15000 })
    await page.fill('#listing-name', 'E2E Creator Onboarding Item')
    await page.fill('#listing-desc', 'Beautiful handcrafted ceramics using traditional European techniques.')
    await page.fill('#listing-price', '49.99')
    await page.fill('#listing-stock', '10')

    // 15. Continue to step 8: Review
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/review/)
    await expect(page.getByRole('heading', { name: /review & open shop/i })).toBeVisible()

    // 16. Accept terms and submit
    await page.check('#terms')
    await page.getByRole('button', { name: /submit for review/i }).click()

    // 17. Verify redirection to status page (pending review)
    await page.waitForURL(/\/sell\/status\/[^/]+/)
    await expect(page.getByRole('heading', { name: /your shop is under review/i })).toBeVisible()

    const statusUrl = new URL(page.url())
    const shopId = statusUrl.pathname.split('/').pop()
    expect(shopId).toMatch(/^[0-9a-f-]+$/)

    // 18. Open separate Admin context to approve shop
    const adminContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
    const adminPage = await adminContext.newPage()

    await adminPage.goto('/admin/shops?view=applications')
    await adminPage.waitForSelector('html[data-hydrated="true"]')

    // 19. Locate the submitted application in the table and click Review Application
    const reviewBtn = adminPage.locator('tr').filter({ hasText: E2E_SHOP_NAME }).getByRole('button', { name: 'Review Application' })
    await expect(reviewBtn).toBeVisible()
    await reviewBtn.click()

    // 20. Click Approve Shop button in the moderation dialog
    const approveBtn = adminPage.getByRole('button', { name: 'Approve Shop' })
    await expect(approveBtn).toBeVisible()
    await approveBtn.click()

    // 21. Verify the dialog closes successfully
    await expect(adminPage.getByRole('heading', { name: /application review details/i })).not.toBeVisible()
    await adminContext.close()

    // 22. Reload the Creator status page and verify it changes to Approved
    await page.reload()
    await expect(page.getByRole('heading', { name: /your shop is approved/i })).toBeVisible()
  })
})
