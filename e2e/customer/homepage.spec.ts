import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Homepage', () => {
  test('renders marketplace sections for guests', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Categories, products, and shops sections should be present.
    await expect(
      page.locator('section[aria-labelledby="categories-heading"] a').first(),
    ).toBeVisible()
    const firstProduct = page.getByLabel(/^Product:/).first()
    await expect(firstProduct).toBeVisible()
    const seededProductImage = firstProduct.getByRole('img')
    await expect(seededProductImage).toBeVisible()
    await expect
      .poll(() => seededProductImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
    await expect(seededProductImage).toHaveScreenshot('seeded-product-image.png', {
      animations: 'disabled',
    })
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
      await waitForAppHydration(page)

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

      await expect(
        page.getByRole('img', {
          name: 'A maker arranging ceramics and textiles in a sunlit workshop',
        }),
      ).toBeVisible()
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
