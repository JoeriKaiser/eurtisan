import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { expect, test } from '@playwright/test'
import { createAdminContext } from '../fixtures/admin'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { createVerifiedCreator, deleteCreatorByEmail } from '../fixtures/creators'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'
const E2E_SHOP_NAME_PREFIX = 'Playwright Rejection Shop'

test.setTimeout(120000)

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 1440, height: 900 },
})

test.describe('onboarding rejection and resubmission', () => {
  let dummyPngPath: string
  let creatorEmail: string | undefined
  let shopId: string | undefined

  test.beforeAll(() => {
    const dummyDir = path.join(__dirname, '../fixtures')
    if (!existsSync(dummyDir)) {
      mkdirSync(dummyDir, { recursive: true })
    }
    dummyPngPath = path.join(dummyDir, 'dummy.png')
    const base64Png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    writeFileSync(dummyPngPath, Buffer.from(base64Png, 'base64'))
  })

  test('creator can be rejected, resubmit, and be approved', async ({ page, browser, context }) => {
    const seed = `rejection-${Date.now()}`
    const fullName = `${E2E_SHOP_NAME_PREFIX} ${seed}`
    const creator = await createVerifiedCreator(seed)
    creatorEmail = creator.email

    // 2. Sign in as the fresh creator via the API
    const signInResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creator.email, password: creator.password }),
    })
    expect(signInResponse.ok).toBeTruthy()

    const setCookie = signInResponse.headers.get('set-cookie')
    if (!setCookie) throw new Error('No session cookie returned from creator sign-in')
    const sessionCookie = setCookie.split(';')[0]
    const eqIdx = sessionCookie.indexOf('=')

    const cookieName = sessionCookie.slice(0, eqIdx)

    const cookieValue = sessionCookie.slice(eqIdx + 1)

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

    // 3. Complete the onboarding wizard
    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await dismissAnalyticsConsentBanner(page)
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()

    await page.evaluate(() => {
      window.confirm = () => true
    })
    await page.getByRole('button', { name: 'Open a New Shop' }).click()

    // Step 1: Identity
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /start with the basics/i })).toBeVisible()
    await page.fill('#shop-name', fullName)
    await expect(page.locator('#shop-slug')).not.toHaveValue('')
    let shopSlug: string | undefined
    try {
      shopSlug = await page.locator('#shop-slug').inputValue()
    } catch {
      // Fallback: the slug field is read-only on some implementations
    }
    await page.fill('#shop-tagline', 'Handcrafted goods for E2E testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByRole('button', { name: 'Handmade by me' }).click()

    // Step 2: Story
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/story/)
    await expect(page.getByRole('heading', { name: /tell your story/i })).toBeVisible()
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

    // Step 3: Visuals
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/visuals/)
    await expect(page.getByRole('heading', { name: /visual identity/i })).toBeVisible()
    await page.setInputFiles('input[id="upload-Shop icon"]', dummyPngPath)
    await expect(page.getByRole('button', { name: 'Remove image' })).toBeVisible({
      timeout: 15000,
    })

    // Step 4: Location
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/location/)
    await expect(page.getByRole('heading', { name: /location & shipping/i })).toBeVisible()
    await page.selectOption('#country', 'FR')
    await page.fill('#tax-id', 'FR123456789')
    await page.fill('#date-of-birth', '1990-01-01')

    // Step 5: Policies
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/policies/)
    await expect(page.getByRole('heading', { name: /shop policies/i })).toBeVisible()

    // Step 6: Socials
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/socials/)
    await expect(page.getByRole('heading', { name: /socials & links/i })).toBeVisible()

    // Step 7: Listing
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/listing/)
    await expect(page.getByRole('heading', { name: /your first listing/i })).toBeVisible()
    await page.setInputFiles('input[type="file"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /remove image/i })).toBeVisible({
      timeout: 15000,
    })
    await page.fill('#listing-name', 'E2E Creator Onboarding Item')
    await page.fill(
      '#listing-desc',
      'Beautiful handcrafted ceramics using traditional European techniques.',
    )
    await page.fill('#listing-price', '49.99')
    await page.fill('#listing-stock', '10')

    // Step 8: Review
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/review/)
    await expect(page.getByRole('heading', { name: /review & open shop/i })).toBeVisible()
    await page.click('#terms')
    const firstSubmitBtn = page.getByRole('button', { name: /submit for review/i })
    await expect(firstSubmitBtn).toBeEnabled()
    await firstSubmitBtn.click()

    await page.waitForURL(/\/sell\/status\/[^/]+/)
    await expect(page.getByRole('heading', { name: /your shop is under review/i })).toBeVisible()

    const statusUrl = new URL(page.url())
    shopId = statusUrl.pathname.split('/').pop()
    expect(shopId).toMatch(/^[0-9a-f-]+$/)

    // 4. Admin rejects the application with a note
    const adminContext = await createAdminContext(browser)
    const adminPage = await adminContext.newPage()

    await adminPage.goto('/admin/shops?view=applications')
    await adminPage.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(adminPage)

    const rowFilter = shopSlug ? `/${shopSlug}` : fullName
    const reviewBtn = adminPage
      .locator('tr')
      .filter({ hasText: rowFilter })
      .getByRole('button', { name: 'Review Application' })
    await expect(reviewBtn).toBeVisible({ timeout: 15000 })
    await reviewBtn.click()

    const rejectionNote = 'Please improve the shop description and provide clearer product photos.'
    await adminPage.fill('#review-note', rejectionNote)
    await adminPage.getByRole('button', { name: 'Request Changes' }).click()

    await expect(
      adminPage.getByRole('heading', { name: /application review details/i }),
    ).not.toBeVisible()
    await adminContext.close()

    // 5. Verify the rejection reason and the "Edit & Resubmit" CTA on the status page
    await page.reload()
    await expect(page.getByRole('heading', { name: /changes requested/i })).toBeVisible()
    await expect(page.getByText(rejectionNote)).toBeVisible()
    const ctaLink = page.getByRole('link', { name: 'Edit & Resubmit' })
    await expect(ctaLink).toBeVisible()
    await ctaLink.click()

    // 6. Resubmit the shop after the requested changes
    // The CTA lands on the onboarding index, which redirects to the current step.
    // Navigate directly to the review step so the creator can resubmit.
    await page.waitForURL(new RegExp(`/sell/onboarding/${shopId}/[^/]+`))
    await page.goto(`/sell/onboarding/${shopId}/review`)
    await page.waitForURL(new RegExp(`/sell/onboarding/${shopId}/review`))
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /review & open shop/i })).toBeVisible()
    await page.click('#terms')
    const submitBtn = page.getByRole('button', { name: /submit for review/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    await page.waitForURL(/\/sell\/status\/[^/]+/)
    await expect(page.getByRole('heading', { name: /your shop is under review/i })).toBeVisible()

    // 7. Admin approves the resubmitted shop
    const adminContext2 = await createAdminContext(browser)
    const adminPage2 = await adminContext2.newPage()

    await adminPage2.goto('/admin/shops?view=applications')
    await adminPage2.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(adminPage2)

    const reviewBtn2 = adminPage2
      .locator('tr')
      .filter({ hasText: rowFilter })
      .getByRole('button', { name: 'Review Application' })
    await expect(reviewBtn2).toBeVisible({ timeout: 15000 })
    await reviewBtn2.click()

    await adminPage2.getByRole('button', { name: 'Approve Shop' }).click()
    await expect(
      adminPage2.getByRole('heading', { name: /application review details/i }),
    ).not.toBeVisible()
    await adminContext2.close()

    // 8. Verify the creator status page shows the shop is approved
    await page.reload()
    await expect(page.getByRole('heading', { name: /your shop is approved/i })).toBeVisible()
  })

  test.afterAll(async () => {
    if (creatorEmail) {
      await deleteCreatorByEmail(creatorEmail)
    }
  })
})
