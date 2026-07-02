import { test, expect, type Page } from '@playwright/test'

async function addProductToCart(page: Page) {
  await page.goto('/search')
  await page.waitForSelector('html[data-hydrated="true"]')

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
    await page.waitForSelector('html[data-hydrated="true"]')

    // Attempt submit without filling address.
    await page.getByRole('button', { name: /confirm purchase/i }).click()

    await expect(page.getByText(/name is required|full name is required/i)).toBeVisible()
    await expect(page).toHaveURL(/\/checkout/)
  })
})
