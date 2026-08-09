import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'

test.describe('Product detail', () => {
  test('renders product information and allows add to cart', async ({ page }) => {
    await page.goto('/search')
    await waitForAppHydration(page)

    const productLink = page.getByLabel(/^Product:/).first()
    await expect(productLink).toBeVisible()
    const productLabel = await productLink.getAttribute('aria-label')
    const productName = productLabel?.replace(/^Product:\s*/, '').trim()
    if (!productName) throw new Error('Product name not found')

    await productLink.click()

    await page.waitForURL(/\/shops\/[^/]+\/products\/[^/]+/)
    await expect(page.getByRole('heading', { level: 1, name: productName.trim() })).toBeVisible()

    await expect(page.getByText(/€/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible()

    // Increase quantity and add to cart.
    await page.getByRole('button', { name: /increase quantity/i }).click()
    await page.getByRole('button', { name: /add to cart/i }).click()

    await expect(page.getByText(/added to cart/i)).toBeVisible()
  })

  test('returns 404 for a non-existent product', async ({ page }) => {
    await page.goto('/shops/test-shop/products/xyznonexistent12345')
    await waitForAppHydration(page)

    await expect(page.getByText(/not found/i)).toBeVisible()
  })
})
