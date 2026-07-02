import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('renders marketplace sections for guests', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Categories, products, and shops sections should be present.
    await expect(page.locator('section[aria-labelledby="categories-heading"] a').first()).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
    await expect(page.locator('section[aria-labelledby="shops-heading"] a').first()).toBeVisible()

    // Marketplace stats and seller CTA.
    await expect(page.getByText(/artisans|makers|shops/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sell/i }).first()).toBeVisible()
  })
})
