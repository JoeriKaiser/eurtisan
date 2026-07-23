import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { getCreatorShop, getTestProduct } from '../fixtures/orders'

test.describe('Shop page', () => {
  test('renders shop header and product list', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    // Click the first featured shop card inside the shops section.
    const firstShop = page.locator('section[aria-labelledby="shops-heading"] a').first()
    await expect(firstShop).toBeVisible()
    await firstShop.click()

    await page.waitForURL(/\/shops\//)
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
  })

  test('filters products with in-site search and clears the query', async ({ page }) => {
    const shop = await getCreatorShop()
    const product = await getTestProduct(shop.id)

    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible()

    // Use a distinctive substring from a known product name to filter results.
    const searchTerm = product.name.slice(0, Math.min(12, product.name.length))
    await page.getByRole('searchbox', { name: /search products/i }).fill(searchTerm)
    await page.getByRole('button', { name: /^search$/i }).click()

    await page.waitForURL(/[?&]search=/)
    await expect(
      page
        .getByLabel(/^Product:/)
        .filter({ hasText: searchTerm })
        .first(),
    ).toBeVisible()

    // Clear the search via direct navigation and confirm the full product grid returns.
    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)

    const clearedUrl = new URL(page.url())
    expect(clearedUrl.searchParams.has('search')).toBe(false)
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
  })

  test('returns 404 for a non-existent shop', async ({ page }) => {
    await page.goto('/shops/xyznonexistent12345')
    await waitForAppHydration(page)

    await expect(page.getByText(/not found/i)).toBeVisible()
  })
})
