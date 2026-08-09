import { waitForAppHydration } from '../fixtures/hydration'
/**
 * Global search overlay behavior.
 *
 * Assumes Meilisearch is seeded with products and categories.
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('Search overlay', () => {
  function getOverlaySearchbox(page: Page) {
    return page.getByRole('dialog', { name: 'Search' }).getByRole('combobox')
  }

  test('opens from the header, shows suggestions, and navigates on submit', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    await page.getByRole('button', { name: /search products/i }).click()

    const searchbox = getOverlaySearchbox(page)
    await expect(searchbox).toBeFocused()

    await page.mouse.move(0, 0)
    await searchbox.fill('ceramic')

    // Suggestions panel should populate.
    const suggestionsList = page
      .getByRole('dialog', { name: 'Search' })
      .getByRole('listbox', { name: /search suggestions/i })
    await expect(suggestionsList).toBeVisible({ timeout: 10000 })
    await expect(suggestionsList.getByRole('option').first()).toBeVisible()

    // Submitting navigates to the search page.
    await searchbox.press('Enter')
    await page.waitForURL(/\/search\?.*q=ceramic/)
    await expect(page.getByRole('heading', { level: 1, name: /ceramic/i })).toBeVisible()
  })

  test('remembers recent searches', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    // Perform a search.
    await page.getByRole('button', { name: /search products/i }).click()
    const searchbox = getOverlaySearchbox(page)
    await searchbox.fill('eurtisan-recent')
    await searchbox.press('Enter')
    await page.waitForURL(/\/search\?.*q=eurtisan-recent/)

    // Reopen overlay and assert the recent search appears.
    await page.goto('/')
    await waitForAppHydration(page)
    await page.getByRole('button', { name: /search products/i }).click()
    await expect(
      page.getByRole('dialog', { name: 'Search' }).getByText(/eurtisan-recent/i),
    ).toBeVisible()
  })
})
