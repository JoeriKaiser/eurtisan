import { test, expect } from '@playwright/test'

test.describe('Category detail', () => {
  test('navigates to a category page and renders products', async ({ page }) => {
    await page.goto('/category/all')
    await page.waitForSelector('html[data-hydrated="true"]')

    const firstCategory = page.locator('main ul a').first()
    await expect(firstCategory).toBeVisible()
    await firstCategory.click()

    await page.waitForURL(/\/category\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('returns 404 for a non-existent category', async ({ page }) => {
    await page.goto('/category/xyznonexistent12345')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByText(/not found/i)).toBeVisible()
  })
})
