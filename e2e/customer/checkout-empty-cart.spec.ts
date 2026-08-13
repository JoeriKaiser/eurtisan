import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'
import { emptyCart } from '../fixtures/cart'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Checkout with empty cart', () => {
  test('redirects to cart with empty cart message', async ({ page }) => {
    await emptyCart(page)

    await page.goto('/checkout')
    await waitForAppHydration(page)

    await expect(page).toHaveURL(/\/cart/)
    await expect(page.getByRole('heading', { name: /your cart is empty/i })).toBeVisible()
  })
})
