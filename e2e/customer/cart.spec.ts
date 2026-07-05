import { expect, test } from '@playwright/test'
import { addFirstProductToCart, emptyCart } from '../fixtures/cart'
import { getCreatorShop, getTestProduct, setProductStock } from '../fixtures/orders'

test.describe('Cart', () => {
  test('adds product, updates quantity, removes item, and shows empty state', async ({ page }) => {
    await emptyCart(page)
    await addFirstProductToCart(page)

    // Go to cart.
    await page.goto('/cart')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /your cart/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /proceed to checkout/i })).toBeVisible()

    // Increase quantity.
    await page.getByRole('button', { name: /increase quantity/i }).click()
    await expect(page.getByText('2').first()).toBeVisible()

    // Remove item.
    await page.getByRole('button', { name: /^remove$/i }).click()
    await page
      .getByRole('button', { name: /^remove$/i })
      .last()
      .click()

    await expect(page.getByText(/your cart is empty/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /browse products/i })).toBeVisible()
  })

  test('blocks quantity increase beyond stock', async ({ page }) => {
    await emptyCart(page)

    // Set a published, active product's stock to a low, deterministic value.
    const shop = await getCreatorShop()
    const product = await getTestProduct(shop.id, 3)

    // Navigate directly to the product whose stock we control.
    await page.goto(`/shops/${shop.slug}/products/${product.slug}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('button', { name: /add to cart/i }).click()
    await page.getByText(/added to cart/i).waitFor({ state: 'visible' })

    await page.goto('/cart')
    await page.waitForSelector('html[data-hydrated="true"]')

    const increaseButton = page.getByRole('button', { name: /increase quantity/i })

    // With stock=3 and cart quantity=1, two increases should hit the cap.
    await increaseButton.click()
    await increaseButton.click()

    await expect(increaseButton).toBeDisabled()
    await expect(page.getByText('Maximum available stock reached')).toBeVisible()

    // Restore generous stock for other specs.
    await setProductStock(product.id, 999)
  })
})
