import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Homepage', () => {
  test('renders marketplace sections for guests', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Categories, products, and shops sections should be present.
    await expect(
      page.locator('section[aria-labelledby="categories-heading"] a').first(),
    ).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
    await expect(page.locator('section[aria-labelledby="shops-heading"] a').first()).toBeVisible()

    // Marketplace stats and seller CTA.
    await expect(page.getByText(/artisans|makers|shops/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sell/i }).first()).toBeVisible()
  })

  test('keeps the image-led hero within narrow mobile viewports', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.waitForSelector('html[data-hydrated="true"]')

      const productCards = page.locator('main').getByLabel(/^Product:/)
      await expect(productCards.first()).toBeAttached()
      await expect(productCards.nth(1)).toBeAttached()

      const firstCardBounds = await productCards.first().boundingBox()
      const secondCardBounds = await productCards.nth(1).boundingBox()
      expect(firstCardBounds).not.toBeNull()
      expect(secondCardBounds).not.toBeNull()
      expect(firstCardBounds?.x).toBeGreaterThanOrEqual(23)
      expect(Math.abs((firstCardBounds?.width ?? 0) - (secondCardBounds?.width ?? 0))).toBeLessThan(
        1,
      )
      expect(
        Math.abs((firstCardBounds?.height ?? 0) - (secondCardBounds?.height ?? 0)),
      ).toBeLessThan(1)

      await expect(page.locator('section').first().locator('img').first()).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(
        page.getByRole('searchbox', { name: /search for handmade products/i }),
      ).toBeVisible()

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(horizontalOverflow).toBeLessThanOrEqual(1)
    }
  })
})
