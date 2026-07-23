import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'
import { createReviewableOrder, getCreatorShop, getProductById } from '../fixtures/orders'

let order: Awaited<ReturnType<typeof createReviewableOrder>>
const reviewComment = `Excellent handcrafted product! ${Date.now()}`

test.beforeAll(async () => {
  order = await createReviewableOrder('customer')
})

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Order reviews', () => {
  test('submits a product review from a delivered order', async ({ page }) => {
    await page.goto(`/orders/${order.platformOrderId}`)
    await waitForAppHydration(page)

    const reviewButton = page.getByRole('button', { name: /write a review/i })
    await expect(reviewButton).toBeVisible()
    await reviewButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Submit should be disabled until a star is selected.
    await expect(dialog.getByRole('button', { name: /submit review/i })).toBeDisabled()
    await expect(dialog).toBeVisible()

    // Select 5 stars.
    await dialog.getByRole('button', { name: /rate 5 out of 5 stars/i }).click()
    await dialog.locator('textarea').fill(reviewComment)
    await dialog.getByRole('button', { name: /submit review/i }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(/review submitted/i)).toBeVisible()
  })

  test('displays the submitted review on the product page', async ({ page }) => {
    const [shop, product] = await Promise.all([getCreatorShop(), getProductById(order.productId)])

    await page.goto(`/shops/${shop.slug}/products/${product.slug}`)
    await waitForAppHydration(page)

    const reviewsHeading = page.getByRole('heading', { name: /^Reviews$/i })
    await expect(reviewsHeading).toBeVisible({ timeout: 10000 })

    const reviewsSection = page.locator('section').filter({ has: reviewsHeading })
    await expect(reviewsSection.getByText(reviewComment)).toBeVisible()
  })
})
