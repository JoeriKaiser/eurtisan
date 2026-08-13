import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'

test.describe('Category detail', () => {
  test('navigates to a category page and renders products', async ({ page }) => {
    await page.goto('/category/all')
    await waitForAppHydration(page)

    const firstCategory = page.locator('main ul a h3').first()
    await expect(firstCategory).toBeVisible()
    const categoryName = await firstCategory.textContent()
    await firstCategory.click()

    // Wait for navigation to an actual category slug, not the /category/all listing.
    await page.waitForURL(
      (url) => /\/category\//.test(url.pathname) && url.pathname !== '/category/all',
    )
    await expect(page.getByRole('heading', { level: 1, name: categoryName ?? '' })).toBeVisible()
  })

  test('returns 404 for a non-existent category', async ({ page }) => {
    await page.goto('/category/xyznonexistent12345')
    await waitForAppHydration(page)

    await expect(page.getByText(/not found/i)).toBeVisible()
  })
})
