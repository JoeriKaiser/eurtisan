import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'

test.describe('admin panel navigation', () => {
  test('admin pages render with sidebar links', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // 1. Dashboard — verify sidebar links exist
    await page.goto('/admin')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('aside a[href="/admin/users"]')).toBeVisible()
    await expect(page.locator('aside a[href="/admin/categories"]')).toBeVisible()
    await expect(page.locator('aside a[href="/admin/products"]')).toBeVisible()

    // 2. Users page
    await page.goto('/admin/users')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({
      timeout: 10000,
    })

    // 3. Categories page
    await page.goto('/admin/categories')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10000 })

    // 4. Products page
    await page.goto('/admin/products')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible({
      timeout: 10000,
    })
  })
})
