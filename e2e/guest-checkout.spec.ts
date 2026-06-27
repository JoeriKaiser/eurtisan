import { test, expect } from '@playwright/test'
import { sendMollieWebhook } from './fixtures/orders'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Guest buyer checkout', () => {
  test('adds a product to cart, checks out, and completes a mock payment', async ({ page }) => {
    await page.goto('/search')
    await page.waitForSelector('html[data-hydrated="true"]')

    // Click the first product card.
    const firstCard = page.getByRole('link', { name: /^Product:/ }).first()
    await expect(firstCard).toBeVisible()
    const productName = await firstCard.locator('h3').textContent()
    if (!productName) throw new Error('Product name not found on product card')
    await firstCard.click()

    await page.waitForURL(/\/shops\/[^/]+\/products\/[^/]+/)
    await expect(page.getByRole('heading', { name: productName, level: 1 })).toBeVisible()

    // Add to cart.
    const addButton = page.getByRole('button', { name: /add to cart/i })
    await addButton.click()
    await expect(page.getByText(/added to cart/i)).toBeVisible()

    // Go to cart and proceed to checkout.
    await page.goto('/cart')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.getByRole('link', { name: /proceed to checkout/i }).click()

    await page.waitForURL('/checkout')
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /checkout/i })).toBeVisible()

    // Fill shipping address.
    await page.getByLabel(/full name/i).fill('E2E Buyer')
    await page.getByLabel(/street address/i).fill('42 Avenue des Champs-Élysées')
    await page.getByLabel(/city/i).fill('Paris')
    await page.getByLabel(/postal code/i).fill('75008')
    await page.getByLabel(/country/i).selectOption('FR')

    // Wait for shipping rates to load. Standard supports service points; select
    // one so the Confirm purchase button becomes enabled.
    const shippingOption = page.getByText(/sendcloud standard/i).first()
    await expect(shippingOption).toBeVisible({ timeout: 10000 })
    await shippingOption.click()

    await page.getByRole('button', { name: /select pick-up point/i }).click()
    await expect(page.getByRole('dialog', { name: /select pick-up point/i })).toBeVisible()
    await page.getByRole('button', { name: /search/i }).click()
    const firstSelect = page.getByRole('button', { name: /^select$/i }).first()
    await expect(firstSelect).toBeVisible({ timeout: 10000 })
    await firstSelect.click()

    // Submit the checkout.
    await page.getByRole('button', { name: /confirm purchase/i }).click()

    // The mock provider redirects to the success page with the mock payment id.
    await page.waitForURL(/\/orders\/[^/]+\/success/)
    const successUrl = new URL(page.url())
    const platformOrderId = successUrl.pathname.split('/')[2]
    const mockPaymentId = successUrl.searchParams.get('mock_payment')
    expect(platformOrderId).toMatch(/^[0-9a-f-]+$/)
    if (!mockPaymentId) throw new Error('mock_payment query param missing from success URL')

    // Simulate the Mollie success webhook that the real gateway would send.
    const response = await sendMollieWebhook(
      process.env.BASE_URL || 'http://localhost:3000',
      mockPaymentId,
      'paid',
    )
    expect(response.status).toBe(200)

    // The success page polls the order; wait for the paid confirmation.
    await expect(page.getByRole('heading', { name: /order placed successfully/i })).toBeVisible({
      timeout: 15000,
    })

    // The buyer order detail should also reflect the paid status.
    await page.goto(`/orders/${platformOrderId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByText(/paid/i).first()).toBeVisible()
  })
})
