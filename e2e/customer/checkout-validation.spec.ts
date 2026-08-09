import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect, type Page } from '@playwright/test'

async function addProductToCart(page: Page) {
  await page.goto('/search')
  await waitForAppHydration(page)

  const productLink = page.getByLabel(/^Product:/).first()
  await expect(productLink).toBeVisible()
  await productLink.click()

  await page.waitForURL(/\/shops\/[^/]+\/products\/[^/]+/)
  await page.getByRole('button', { name: /add to cart/i }).click()
  await expect(page.getByText(/added to cart/i)).toBeVisible()
}

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Checkout validation', () => {
  test('blocks submission when required address fields are empty', async ({ page }) => {
    await addProductToCart(page)

    await page.goto('/checkout')
    await waitForAppHydration(page)

    // Submission remains unavailable until the required address is complete.
    await expect(page.getByRole('button', { name: /confirm purchase/i })).toBeDisabled()
    await expect(page.getByText(/enter a complete delivery address/i).last()).toBeVisible()
    await expect(page).toHaveURL(/\/checkout/)
  })
})
