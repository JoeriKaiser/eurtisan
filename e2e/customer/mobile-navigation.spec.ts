import { expect, test, type Page } from '@playwright/test'

async function waitForMobileMenuHydration(page: Page) {
  await page.locator('button[data-mobile-nav-hydrated="true"]').waitFor()
}

test.use({
  storageState: 'e2e/.auth/customer.json',
  viewport: { width: 390, height: 844 },
})

test.describe('Mobile navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')
    await waitForMobileMenuHydration(page)
  })

  test('opens as a full-screen market map and restores focus when dismissed', async ({ page }) => {
    const menuTrigger = page.getByRole('button', { name: 'Open menu' })
    await menuTrigger.focus()
    await menuTrigger.click()

    const navigation = page.getByRole('dialog', { name: 'Mobile navigation' })
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Explore the market' })).toBeVisible()
    await expect(navigation.getByRole('heading', { name: 'Browse by craft' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: /View all \d+/ })).toBeVisible()

    const bounds = await navigation.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds?.width).toBe(390)
    expect(bounds?.height).toBe(844)

    await page.keyboard.press('Escape')
    await expect(navigation).toBeHidden()
    await expect(menuTrigger).toBeFocused()
  })

  test('navigates directly to a craft from the category matrix', async ({ page }) => {
    await page.getByRole('button', { name: 'Open menu' }).click()

    const navigation = page.getByRole('dialog', { name: 'Mobile navigation' })
    await navigation.getByRole('link', { name: 'Ceramics' }).click()

    await page.waitForURL('/category/ceramics')
    await expect(page.getByRole('heading', { name: 'Ceramics', level: 1 })).toBeVisible()
  })

  test('hands off to the existing search overlay', async ({ page }) => {
    await page.getByRole('button', { name: 'Open menu' }).click()

    const navigation = page.getByRole('dialog', { name: 'Mobile navigation' })
    await navigation.getByRole('button', { name: 'Find an object or maker' }).click()

    await expect(navigation).toBeHidden()
    const searchDialog = page.getByRole('dialog', { name: 'Search' })
    await expect(searchDialog).toBeVisible()
    await expect(searchDialog.getByRole('searchbox')).toBeFocused()
  })
})
