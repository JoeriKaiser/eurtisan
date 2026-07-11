import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { getCreatorShop } from '../fixtures/orders'

test.describe('creator advanced shop settings', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  let shopId: string
  let originalSlug: string
  let originalName: string
  let originalDescription: string
  let originalBusinessAddress: Record<string, unknown> | null
  let originalShippingOrigin: Record<string, unknown> | null
  let originalPolicies: Record<string, unknown> | null
  let originalAnnouncement: string | null
  let originalSocials: Array<{ platform: string; url: string }>

  test.beforeAll(async () => {
    const shop = await getCreatorShop()

    shopId = shop.id
    originalSlug = shop.slug
    originalName = shop.name
    originalDescription = shop.description ?? ''
    originalBusinessAddress = (shop.businessAddress ?? null) as Record<string, unknown> | null
    originalShippingOrigin = (shop.shippingOrigin ?? null) as Record<string, unknown> | null
    originalPolicies = (shop.policies ?? null) as Record<string, unknown> | null
    originalAnnouncement = shop.announcement ?? null

    const socials = await db
      .select({ platform: schema.shopSocials.platform, url: schema.shopSocials.url })
      .from(schema.shopSocials)
      .where(eq(schema.shopSocials.shopId, shopId))

    originalSocials = socials.map((s) => ({ platform: s.platform, url: s.url }))
  })

  test.afterAll(async () => {
    await db
      .update(schema.shop)
      .set({
        slug: originalSlug,
        name: originalName,
        description: originalDescription,
        businessAddress: originalBusinessAddress,
        shippingOrigin: originalShippingOrigin,
        policies: originalPolicies,
        announcement: originalAnnouncement,
      })
      .where(eq(schema.shop.id, shopId))

    await db.delete(schema.shopSocials).where(eq(schema.shopSocials.shopId, shopId))

    if (originalSocials.length > 0) {
      await db.insert(schema.shopSocials).values(
        originalSocials.map((s) => ({
          id: randomUUID(),
          shopId,
          platform: s.platform as (typeof schema.shopSocialPlatformEnum.enumValues)[number],
          url: s.url,
        })),
      )
    }
  })

  test('creator can update shop slug, business address, return policy, and social links', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now().toString()
    const newSlug = `e2e-advanced-shop-${uniqueSuffix}`
    const newBusinessStreet = '123 Advanced Avenue'
    const newBusinessCity = 'Berlin'
    const newBusinessPostal = '10115'
    const newBusinessCountry = 'DE'
    const newReturnPolicy = 'Custom 14-day return policy for advanced settings test.'
    const newSocialUrl = 'https://instagram.com/e2e-advanced-shop'
    const newAnnouncement = 'Welcome to the advanced shop settings test run!'

    await page.goto(`/creator/shop?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)
    await page.waitForLoadState('networkidle')

    // Update slug and wait for availability check.
    await page.fill('#shop-slug', newSlug)
    await page.getByLabel('Slug is available').waitFor({ state: 'visible', timeout: 10000 })

    // Update business address.
    await page.fill('#business-street', newBusinessStreet)
    await page.fill('#business-city', newBusinessCity)
    await page.fill('#business-postal', newBusinessPostal)
    await page.fill('#business-country', newBusinessCountry)

    // Update return policy to a custom policy.
    await page.getByRole('button', { name: 'Custom' }).first().click()
    await page.getByRole('textbox', { name: 'Returns' }).fill(newReturnPolicy)

    // Update public announcement.
    await page.fill('#shop-announcement', newAnnouncement)

    // Remove any existing social links so we can add a fresh one.
    const removeButtons = page.getByRole('button', { name: /^Remove / })
    for (let i = await removeButtons.count(); i > 0; i--) {
      await removeButtons.first().click()
    }

    // Add a new social link.
    await page.selectOption('#new-social-platform', 'instagram')
    await page.fill('#new-social-url', newSocialUrl)
    await page.getByRole('button', { name: 'Add link' }).click()
    await expect(page.getByText(newSocialUrl)).toBeVisible()

    // Save changes.
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Shop settings saved successfully.')).toBeVisible({
      timeout: 15000,
    })

    // Reload and verify values persisted.
    await page.goto(`/creator/shop?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('#shop-slug')).toHaveValue(newSlug)
    await expect(page.locator('#business-street')).toHaveValue(newBusinessStreet)
    await expect(page.locator('#business-city')).toHaveValue(newBusinessCity)
    await expect(page.locator('#business-postal')).toHaveValue(newBusinessPostal)
    await expect(page.locator('#business-country')).toHaveValue(newBusinessCountry)
    await expect(page.getByRole('textbox', { name: 'Returns' })).toHaveValue(newReturnPolicy)
    await expect(page.locator('#shop-announcement')).toHaveValue(newAnnouncement)
    await expect(page.getByText(newSocialUrl)).toBeVisible()

    // Verify the new slug is reachable on the public shop page.
    await page.goto(`/shops/${newSlug}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { level: 1, name: originalName })).toBeVisible()
  })
})
