import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Search', () => {
  test('lists category shortcuts in discovery mode', async ({ page }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')

    const categoryNavigation = page.getByRole('navigation', { name: /^category$/i })
    await expect(categoryNavigation.getByRole('link', { name: 'All categories' })).toBeVisible()
    await expect(categoryNavigation.getByRole('link', { name: 'Ceramics' })).toBeVisible()
    await expect(categoryNavigation.getByRole('link', { name: 'Textiles' })).toBeVisible()
    await expect(categoryNavigation.getByRole('link', { name: 'Woodwork' })).toBeVisible()
  })

  test('supports category filtering and sorting in discovery mode', async ({ page }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: 'Explore the market' })).toBeVisible()
    await expect(page.getByText(/^\d+ objects to explore$/i)).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()

    const categoryNavigation = page.getByRole('navigation', { name: /^category$/i })
    const ceramicsLink = categoryNavigation.getByRole('link', { name: 'Ceramics' })
    await ceramicsLink.click()
    await page.waitForURL(/[?&]category=ceramics/)
    await expect(ceramicsLink).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()

    const sortNavigation = page.getByRole('navigation', { name: /^sort by$/i })
    const priceDescendingLink = sortNavigation.getByRole('link', { name: 'Price (High to Low)' })
    await priceDescendingLink.click()
    await page.waitForURL(/[?&]sort=price_desc/)
    await expect(priceDescendingLink).toHaveAttribute('aria-current', 'page')

    await categoryNavigation.getByRole('link', { name: 'All categories' }).click()
    await page.waitForURL((url) => !url.searchParams.has('category'))
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
  })

  test('supports pagination across query result pages', async ({ page }) => {
    await page.goto('/search?q=artisan')
    await page.waitForSelector('html[data-hydrated="true"]')

    const pagination = page.getByRole('navigation', { name: /product pagination/i })
    await expect(pagination).toBeVisible()
    await expect(pagination.getByText(/page 1 of \d+/i)).toBeVisible()

    const nextLink = pagination.getByRole('link', { name: /next/i })
    await expect(nextLink).toBeVisible()

    const firstProductOnPage1 = page.getByLabel(/^Product:/).first()
    await expect(firstProductOnPage1).toBeVisible()
    const productLabelPage1 = await firstProductOnPage1.getAttribute('aria-label')
    expect(productLabelPage1).toBeTruthy()

    await nextLink.click()
    await page.waitForURL(/[?&]page=2/)
    await expect(pagination.getByText(/page 2 of \d+/i)).toBeVisible()

    const firstProductOnPage2 = page.getByLabel(/^Product:/).first()
    await expect(firstProductOnPage2).toBeVisible()
    await expect(firstProductOnPage2).not.toHaveAttribute('aria-label', productLabelPage1 ?? '')

    await pagination.getByRole('link', { name: /previous/i }).click()
    await page.waitForURL((url) => !url.searchParams.has('page'))
    await expect(pagination.getByText(/page 1 of \d+/i)).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toHaveAttribute(
      'aria-label',
      productLabelPage1 ?? '',
    )
  })

  test('shows an empty state for a non-matching query', async ({ page }) => {
    await page.goto('/search?q=xyznonexistent12345')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /results for/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /no results found/i })).toBeVisible()
    const clearLink = page.getByRole('link', { name: /clear filters/i })
    await expect(clearLink).toBeVisible()
    await clearLink.click()
    await page.waitForURL((url) => url.pathname.endsWith('/search') && url.search === '')
    await expect(page.getByRole('heading', { name: 'Explore the market' })).toBeVisible()
  })
})
