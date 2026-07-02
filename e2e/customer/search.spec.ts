import { expect, test } from '@playwright/test'

test.describe('Search', () => {
  test('shows all products by default and supports filters, sort, and pagination', async ({
    page,
  }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /find handmade products/i })).toBeVisible()

    const resultsCount = page.getByText(/^\d+ results?$/i)

    // Default state: results count and product grid.
    await expect(resultsCount.first()).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()

    // Query search.
    await page.getByRole('searchbox', { name: /search products/i }).fill('eurtisan')
    await page.getByRole('button', { name: /^search$/i }).click()

    await expect(resultsCount.first()).toBeVisible()

    // Category filter.
    await page.getByLabel(/^category$/i).selectOption({ index: 1 })
    await expect(resultsCount.first()).toBeVisible()

    // Shop filter.
    await page.getByLabel(/^shop$/i).selectOption({ index: 1 })
    await expect(resultsCount.first()).toBeVisible()

    // Price filter.
    await page.getByLabel(/^min price$/i).fill('0')
    await page.getByLabel(/^max price$/i).fill('1000')
    await page.getByLabel(/^max price$/i).press('Enter')
    await expect(resultsCount.first()).toBeVisible()

    // Sort.
    await page.getByLabel(/^sort by$/i).selectOption('price_desc')
    await expect(resultsCount.first()).toBeVisible()

    // Clear filters.
    await page.getByRole('button', { name: /clear filters/i }).click()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
  })

  test('supports pagination across result pages', async ({ page }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')

    // The E2E seed creates enough products for multiple pages.
    const pagination = () => page.locator('nav').filter({ hasText: /page \d+ of \d+/i })
    await expect(pagination()).toBeVisible()
    await expect(pagination().getByText(/page 1 of \d+/i)).toBeVisible()

    // Wait for the next button to be enabled before interacting.
    const nextButton = pagination().getByRole('button', { name: /next/i })
    await expect(nextButton).toBeEnabled()

    // Capture the first product name on page 1 to prove page 2 differs.
    const firstProductOnPage1 = page.getByLabel(/^Product:/).first()
    await expect(firstProductOnPage1).toBeVisible()
    const productNamePage1Raw = await firstProductOnPage1.textContent()
    expect(productNamePage1Raw).toBeTruthy()
    const productNamePage1 = productNamePage1Raw as string

    await nextButton.click()
    await page.waitForURL(/[?&]page=2/)
    await expect(pagination().getByText(/page 2 of \d+/i)).toBeVisible()

    const firstProductOnPage2 = page.getByLabel(/^Product:/).first()
    await expect(firstProductOnPage2).toBeVisible()
    const productNamePage2Raw = await firstProductOnPage2.textContent()
    expect(productNamePage2Raw).not.toEqual(productNamePage1)

    const previousButton = pagination().getByRole('button', { name: /previous/i })
    await previousButton.click()
    await page.waitForURL((url) => !url.searchParams.has('page'))
    await expect(pagination().getByText(/page 1 of \d+/i)).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toHaveText(productNamePage1)
  })

  test('shows empty state for non-matching query', async ({ page }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('searchbox', { name: /search products/i }).fill('xyznonexistent12345')
    await page.getByRole('button', { name: /^search$/i }).click()

    await expect(page.getByText(/no results/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /browse categories/i })).toBeVisible()
  })
})
