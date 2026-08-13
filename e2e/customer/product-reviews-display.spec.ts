import { waitForAppHydration } from '../fixtures/hydration'
/**
 * Product reviews display on the public product detail page.
 *
 * Assumes the seeded E2E database contains approved reviews.
 */

import { test, expect } from '@playwright/test'
import { getCreatorShop, getShopProductWithReviews } from '../fixtures/orders'

test.describe('Product reviews display', () => {
  test('shows the reviews section and at least one review', async ({ page }) => {
    const shop = await getCreatorShop()
    const product = await getShopProductWithReviews(shop.id)

    await page.goto(`/shops/${shop.slug}/products/${product.slug}`)
    await waitForAppHydration(page)

    // Reviews are fetched client-side; wait for the section heading.
    const reviewsHeading = page.getByRole('heading', { name: /^Reviews$/ })
    await expect(reviewsHeading).toBeVisible({ timeout: 10000 })

    const reviewsSection = page.locator('section').filter({ has: reviewsHeading })

    // Average rating summary and review count should be present.
    await expect(reviewsSection.getByText(/\d+\.\d/)).toBeVisible()
    await expect(reviewsSection.getByText(/\d+ reviews?/i)).toBeVisible()

    // At least one review item (rendered as an <article>).
    await expect(reviewsSection.locator('article').first()).toBeVisible()
  })
})

test.describe('Authenticated review actions', () => {
  test.use({ storageState: 'e2e/.auth/customer.json' })

  test('reports a review and disables the report button', async ({ page }) => {
    const shop = await getCreatorShop()
    const product = await getShopProductWithReviews(shop.id)

    await page.goto(`/shops/${shop.slug}/products/${product.slug}`)
    await waitForAppHydration(page)

    const reviewsHeading = page.getByRole('heading', { name: /^Reviews$/ })
    await expect(reviewsHeading).toBeVisible({ timeout: 10000 })

    const firstReview = page.locator('article').first()
    const reportButton = firstReview.getByRole('button', { name: /report review/i })
    await expect(reportButton).toBeVisible()
    await reportButton.click()
    const reportDialog = page.getByRole('dialog', { name: /report this review/i })
    await expect(reportDialog).toBeVisible()
    await reportDialog.getByRole('button', { name: /send report/i }).click()

    await expect(firstReview.getByRole('button', { name: /review reported/i })).toBeVisible()
    await expect(firstReview.getByRole('button', { name: /report review/i })).not.toBeVisible()
  })
})
