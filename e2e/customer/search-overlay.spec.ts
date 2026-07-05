/**
 * Global search overlay behavior.
 *
 * Assumes Meilisearch is seeded with products and categories.
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('Search overlay', () => {
  function getOverlaySearchbox(page: Page) {
    return page.getByRole('dialog', { name: 'Search' }).getByRole('searchbox')
  }

  test('opens from the header, shows suggestions, and navigates on submit', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('button', { name: /search products/i }).click()

    const searchbox = getOverlaySearchbox(page)
    await expect(searchbox).toBeFocused()

    await searchbox.fill('ceramic')

    // Suggestions panel should populate.
    const suggestionsList = page.getByRole('dialog', { name: 'Search' }).getByRole('list', {
      name: /search suggestions/i,
    })
    await expect(suggestionsList).toBeVisible({ timeout: 10000 })
    await expect(suggestionsList.getByRole('listitem').first()).toBeVisible()

    // Submitting navigates to the search page.
    await searchbox.press('Enter')
    await page.waitForURL(/\/search\?.*q=ceramic/)
    await expect(page.getByRole('heading', { name: /find handmade products/i })).toBeVisible()
  })

  test('remembers recent searches', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')

    // Perform a search.
    await page.getByRole('button', { name: /search products/i }).click()
    const searchbox = getOverlaySearchbox(page)
    await searchbox.fill('eurtisan-recent')
    await searchbox.press('Enter')
    await page.waitForURL(/\/search\?.*q=eurtisan-recent/)

    // Reopen overlay and assert the recent search appears.
    await page.goto('/')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.getByRole('button', { name: /search products/i }).click()
    await expect(
      page.getByRole('dialog', { name: 'Search' }).getByText(/eurtisan-recent/i),
    ).toBeVisible()
  })
})
