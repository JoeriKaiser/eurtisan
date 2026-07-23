import { waitForAppHydration } from '../fixtures/hydration'
/**
 * Caveat: the service-point "no results" state is unreachable in E2E because the mock
 * shipping provider always returns pick-up points. This spec exercises the happy path
 * of selecting a point and completing checkout.
 */

import { test, expect, type Page } from '@playwright/test'
import { sendMollieWebhook } from '../fixtures/orders'

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

test.describe('Checkout with separate billing address', () => {
  test('completes checkout using a different billing address', async ({ page }) => {
    await addProductToCart(page)

    await page.goto('/checkout')
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: /checkout/i })).toBeVisible()

    // Shipping address.
    await page.getByLabel(/full name/i).fill('E2E Buyer')
    await page.getByLabel(/street address/i).fill('42 Avenue des Champs-Élysées')
    await page.getByLabel(/city/i).fill('Paris')
    await page.getByLabel(/postal code/i).fill('75008')
    await page.getByLabel(/country/i).selectOption('FR')

    // Wait for shipping options.
    const shippingOption = page.getByText(/sendcloud standard/i).first()
    await expect(shippingOption).toBeVisible({ timeout: 10000 })
    await shippingOption.click()

    // Select pickup point.
    await page.getByRole('button', { name: /select pick-up point/i }).click()
    await expect(page.getByRole('dialog', { name: /select pick-up point/i })).toBeVisible()
    await page.getByRole('button', { name: /search/i }).click()
    const firstSelect = page.getByRole('button', { name: /^select$/i }).first()
    await expect(firstSelect).toBeVisible({ timeout: 10000 })
    await firstSelect.click()

    // Separate billing address.
    await page.getByLabel(/same as shipping/i).uncheck()
    const billingSection = page.locator('section').filter({ hasText: /billing address/i })
    await billingSection.getByLabel(/full name/i).fill('E2E Billing')
    await billingSection.getByLabel(/street address/i).fill('1 Rue de la Paix')
    await billingSection.getByLabel(/city/i).fill('Lyon')
    await billingSection.getByLabel(/postal code/i).fill('69001')
    await billingSection.getByLabel(/country/i).selectOption('FR')

    await page.getByRole('button', { name: /confirm purchase/i }).click()

    await page.waitForURL(/\/orders\/[^/]+\/success/)
    const successUrl = new URL(page.url())
    const platformOrderId = successUrl.pathname.split('/')[2]
    const mockPaymentId = successUrl.searchParams.get('mock_payment')
    expect(platformOrderId).toMatch(/^[0-9a-f-]+$/)
    if (!mockPaymentId) throw new Error('mock_payment query param missing')

    const response = await sendMollieWebhook(
      process.env.BASE_URL || 'http://localhost:3000',
      mockPaymentId,
      'paid',
    )
    expect(response.status).toBe(200)

    await expect(page.getByRole('heading', { name: /order placed successfully/i })).toBeVisible({
      timeout: 15000,
    })
  })
})
