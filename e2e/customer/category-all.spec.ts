import { test, expect } from '@playwright/test'

test.describe('Category listing', () => {
  test('renders the category grid', async ({ page }) => {
    await page.goto('/category/all')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /categories/i })).toBeVisible()
    await expect(page.getByRole('link').first()).toBeVisible()
  })
})
