import { expect, test } from '@playwright/test'

test.describe('admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin')
    await page.waitForSelector('html[data-hydrated="true"]')
  })

  test('dashboard renders stat cards and navigation', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Admin Dashboard', level: 1, exact: true }),
    ).toBeVisible()

    await expect(page.getByText('Total Users')).toBeVisible()
    await expect(page.getByText('Active Shops')).toBeVisible()
    await expect(page.getByText('Open Disputes')).toBeVisible()
    await expect(page.getByText('Pending Payouts')).toBeVisible()
  })

  test('recent signups and recent orders sections render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Recent Signups', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent Orders', exact: true })).toBeVisible()
  })

  test('sidebar navigation links are present', async ({ page }) => {
    const sidebar = page.locator('aside')

    const links = [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Users', href: '/admin/users' },
      { label: 'Categories', href: '/admin/categories' },
      { label: 'Products', href: '/admin/products' },
      { label: 'Shops', href: '/admin/shops' },
      { label: 'Orders', href: '/admin/orders' },
      { label: 'Disputes', href: '/admin/disputes' },
      { label: 'Payouts', href: '/admin/payouts' },
      { label: 'Reviews', href: '/admin/reviews' },
      { label: 'Audit Log', href: '/admin/audit-log' },
    ]

    for (const { label, href } of links) {
      const link = sidebar.getByRole('link', { name: label, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', href)
    }
  })

  test('search modal opens with keyboard shortcut', async ({ page }) => {
    // Focus the page body so the global window keydown handler receives the shortcut.
    await page.locator('body').click()

    await page.keyboard.press('Control+Shift+K')

    const searchInput = page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Search admin…', exact: true })
    await expect(searchInput).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(searchInput).not.toBeVisible()
  })
})
