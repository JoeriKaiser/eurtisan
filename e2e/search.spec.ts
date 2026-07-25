import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { waitForAppHydration } from './fixtures/hydration'

/**
 * Search is the primary discovery path, but had no end-to-end coverage. These
 * cover the contract the whole stack has to keep: a query reaches the results
 * page, filters survive a round trip through the URL, and the overlay is
 * operable from the keyboard.
 */
/** The filter panel is a <details> element, collapsed on first render. */
async function openFilterPanel(page: Page): Promise<void> {
  await page
    .locator('details')
    .filter({ hasText: /filters/i })
    .locator('summary')
    .first()
    .click()
}

test.describe('Search', () => {
  test('runs a query from the results page URL', async ({ page }) => {
    await page.goto('/search?q=ceramic')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/ceramic/i)
  })

  test('shows the browse view when no query is given', async ({ page }) => {
    await page.goto('/search')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('keeps filters in the URL so results are shareable', async ({ page }) => {
    await page.goto('/search?q=ceramic&minPrice=1000&maxPrice=500000')
    await waitForAppHydration(page)

    // The filter panel is a collapsed <details>; open it before asserting.
    await openFilterPanel(page)

    await expect(page.getByLabel(/min price/i)).toHaveValue('10')
    await expect(page.getByLabel(/max price/i)).toHaveValue('5000')
  })

  test('applies the in-stock filter through the URL', async ({ page }) => {
    await page.goto('/search?q=ceramic&inStock=true')
    await waitForAppHydration(page)

    await openFilterPanel(page)

    await expect(page.getByRole('checkbox', { name: /in stock only/i })).toBeChecked()
  })

  test('opens the overlay and exposes combobox semantics', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click()

    const input = page.getByRole('combobox')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('aria-expanded', 'false')

    await input.fill('ceramic')
    // Suggestions are debounced; the listbox appears once they resolve.
    await expect(input).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('listbox')).toBeVisible()
  })

  test('navigates suggestions with the keyboard and searches on Enter', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click()

    const input = page.getByRole('combobox')
    await input.fill('ceramic')
    await expect(page.getByRole('listbox')).toBeVisible()

    // Arrow keys move the active option, which must be reflected for AT.
    await input.press('ArrowDown')
    await expect(input).toHaveAttribute('aria-activedescendant', /search-suggestion-0/)

    await input.press('Enter')
    await expect(page).toHaveURL(/\/search\?.*q=ceramic/)
  })

  test('offers recovery instead of a dead end when nothing matches', async ({ page }) => {
    await page.goto('/search?q=zzzzznotathing')
    await waitForAppHydration(page)

    await expect(page.getByText(/no products|geen producten/i).first()).toBeVisible()
  })
})
