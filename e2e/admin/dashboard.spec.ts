import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'

test.describe('admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin')
    await waitForAppHydration(page)
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
      { name: /^Dashboard$/, href: /^\/admin$/ },
      { name: /^Users$/, href: /^\/admin\/users$/ },
      { name: /^Categories$/, href: /^\/admin\/categories$/ },
      { name: /^Products$/, href: /^\/admin\/products$/ },
      { name: /^Shops(?:\s|$)/, href: /^\/admin\/shops(?:\?|$)/ },
      { name: /^Orders$/, href: /^\/admin\/orders$/ },
      { name: /^Disputes$/, href: /^\/admin\/disputes$/ },
      { name: /^Payouts$/, href: /^\/admin\/payouts$/ },
      { name: /^Reviews$/, href: /^\/admin\/reviews$/ },
      { name: /^Audit Log$/, href: /^\/admin\/audit-log$/ },
    ]

    for (const { name, href } of links) {
      const link = sidebar.getByRole('link', { name })
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
