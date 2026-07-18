import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { expect, test } from '@playwright/test'
import { createAdminContext } from '../fixtures/admin'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { createVerifiedCreator, deleteCreatorByEmail } from '../fixtures/creators'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'
const E2E_SHOP_NAME_PREFIX = 'Playwright Rejection Shop'

test.setTimeout(180000)
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })

test.describe('onboarding changes-requested and resubmission', () => {
  let dummyPngPath: string
  let creatorEmail: string | undefined

  test.beforeAll(() => {
    const dummyDir = path.join(__dirname, '../fixtures')
    if (!existsSync(dummyDir)) mkdirSync(dummyDir, { recursive: true })
    dummyPngPath = path.join(dummyDir, 'onboarding-rejection.png')
    writeFileSync(
      dummyPngPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      ),
    )
  })

  test.afterAll(async () => {
    if (creatorEmail) await deleteCreatorByEmail(creatorEmail)
  })

  test('creator returns to the requested stage, resubmits, and is approved', async ({
    page,
    browser,
    context,
  }) => {
    const seed = `rejection-${Date.now()}`
    const fullName = `${E2E_SHOP_NAME_PREFIX} ${seed}`
    const creator = await createVerifiedCreator(seed)
    creatorEmail = creator.email

    const signInResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creator.email, password: creator.password }),
    })
    expect(signInResponse.ok).toBeTruthy()
    const setCookie = signInResponse.headers.get('set-cookie')
    if (!setCookie) throw new Error('No session cookie returned from creator sign-in')
    const sessionCookie = setCookie.split(';')[0]
    const separator = sessionCookie.indexOf('=')
    await context.addCookies([
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

    await page.goto('/sell')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.waitForLoadState('networkidle')
    await dismissAnalyticsConsentBanner(page)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Create a shop' }).click()

    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await page.fill('#shop-name', fullName)
    const submittedShopName = await page.locator('#shop-name').inputValue()
    await page.fill('#shop-tagline', 'Handcrafted goods for E2E testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByLabel('Handmade by me').check()
    await page.fill(
      '#shop-description',
      'We create beautiful handcrafted ceramics using traditional European techniques in our small workshop.',
    )
    await page.setInputFiles('input[type="file"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /remove shop icon/i })).toBeVisible({
      timeout: 15000,
    })
    const shopSlug = await page.locator('#shop-slug').inputValue()

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/location/)
    await page.selectOption('#dispatch-country', 'FR')
    await page.fill('#dispatch-city', 'Lyon')
    await page.fill('#dispatch-postal', '69001')
    await page.fill('#business-street', '4 Rue Mercière')
    await page.fill('#business-city', 'Lyon')
    await page.fill('#business-postal', '69001')
    await page.selectOption('#business-country', 'FR')
    await page.fill('#tax-id', 'FRTIN123456')
    await page.fill('#date-of-birth', '1990-01-01')

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/listing/)
    await page.fill('#listing-name', 'E2E Changes Requested Item')
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
    await page.waitForURL(/\/policies/)
    await page.getByLabel(/i understand that my shop policies/i).check()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/review/)
    await page.getByLabel(/i agree to the seller terms/i).check()
    await page.getByRole('button', { name: /submit shop for review/i }).click()

    await page.waitForURL(/\/sell\/status\/[^/]+/)
    await expect(page.getByRole('heading', { name: /your shop is under review/i })).toBeVisible()
    const shopId = new URL(page.url()).pathname.split('/').pop()
    if (!shopId) throw new Error('Submitted shop id was missing from the status URL')

    const adminContext = await createAdminContext(browser)
    const adminPage = await adminContext.newPage()
    await adminPage.goto('/admin/shops?view=applications')
    await adminPage.waitForSelector('html[data-hydrated="true"]')
    await adminPage.waitForLoadState('networkidle')
    await dismissAnalyticsConsentBanner(adminPage)
    await adminPage.waitForLoadState('networkidle')
    await adminPage
      .locator('tr')
      .filter({ hasText: `/${shopSlug}` })
      .getByRole('button', { name: 'Review Application' })
      .click()
    await expect(adminPage.getByRole('dialog')).toBeVisible()

    const rejectionNote = 'Please expand the shop story and clarify the making process.'
    await adminPage.selectOption('#review-stage', '1')
    await adminPage.fill('#review-note', rejectionNote)
    await adminPage.getByRole('button', { name: 'Request Changes' }).click()
    await adminContext.close()

    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(`Changes requested for ${submittedShopName}`)).toBeVisible()
    await expect(page.getByText(rejectionNote)).toBeVisible()
    await page
      .getByRole('button', {
        name: new RegExp(`Changes requested for ${submittedShopName}`, 'i'),
      })
      .click()
    await page.waitForURL(new RegExp(`/sell/status/${shopId}`))
    await expect(page.getByRole('heading', { name: /changes requested/i })).toBeVisible()
    await expect(page.getByText(rejectionNote)).toBeVisible()
    await page.getByRole('link', { name: 'Review requested changes' }).click()
    await page.waitForURL(new RegExp(`/sell/onboarding/${shopId}/identity`))
    await expect(page.locator('#shop-description')).toHaveValue(/traditional European techniques/)

    await page.goto(`/sell/onboarding/${shopId}/review`)
    await page.waitForLoadState('networkidle')
    await page.getByLabel(/i agree to the seller terms/i).check()
    await page.getByRole('button', { name: /submit shop for review/i }).click()
    await page.waitForURL(/\/sell\/status\/[^/]+/)

    const adminContext2 = await createAdminContext(browser)
    const adminPage2 = await adminContext2.newPage()
    await adminPage2.goto('/admin/shops?view=applications')
    await adminPage2.waitForSelector('html[data-hydrated="true"]')
    await adminPage2.waitForLoadState('networkidle')
    await adminPage2
      .locator('tr')
      .filter({ hasText: `/${shopSlug}` })
      .getByRole('button', { name: 'Review Application' })
      .click()
    await expect(adminPage2.getByRole('dialog')).toBeVisible()
    await adminPage2.getByRole('button', { name: 'Approve Shop' }).click()
    await adminContext2.close()

    await page.reload()
    await expect(page.getByRole('heading', { name: /your shop is approved/i })).toBeVisible()
  })
})
