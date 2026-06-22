import { test, expect } from '@playwright/test'

test.describe('admin panel navigation', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('admin pages render with sidebar links', async ({ page }) => {
    page.on('console', (msg) => console.log('ADMIN PANEL PAGE LOG:', msg.text()))
    page.on('pageerror', (err) => console.error('ADMIN PANEL PAGE ERROR:', err.message, err.stack))
    await page.setViewportSize({ width: 1440, height: 900 })

    // 1. Dashboard — verify sidebar links exist
    await page.goto('/admin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('aside a[href="/admin/users"]')).toBeVisible()
    await expect(page.locator('aside a[href="/admin/categories"]')).toBeVisible()
    await expect(page.locator('aside a[href="/admin/products"]')).toBeVisible()

    // 2. Users page
    await page.goto('/admin/users')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({
      timeout: 10000,
    })

    // 3. Categories page
    await page.goto('/admin/categories')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 10000 })

    // 4. Products page
    await page.goto('/admin/products')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: 'Product Catalog' })).toBeVisible({
      timeout: 10000,
    })
  })
})
