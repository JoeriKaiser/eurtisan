/**
 * End-to-end purchase journey.
 *
 * Environment assumptions:
 * - Uses the shared `e2e/.auth/customer.json` customer.
 * - Relies on `completeCheckout`, which assumes a single-shop cart and the
 *   first shipping option supporting service points in this dev environment.
 * - Mollie payments are mocked via the existing `sendMollieWebhook` helper.
 */

import { test, expect } from '@playwright/test'
import { emptyCart } from '../fixtures/cart'
import { completeCheckout } from '../fixtures/checkout'
import { addFirstProductToCart } from '../fixtures/cart'
import { sendMollieWebhook } from '../fixtures/orders'

test.use({ storageState: 'e2e/.auth/customer.json' })

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Checkout purchase journey', () => {
  test('completes a full purchase from product page to paid order', async ({ page }) => {
    await emptyCart(page)
    await addFirstProductToCart(page)

    const { platformOrderId, orderNumber, mockPaymentId } = await completeCheckout(page)

    // Simulate Mollie paying the checkout.
    const webhookResponse = await sendMollieWebhook(baseURL, mockPaymentId, 'paid')
    expect(webhookResponse.status).toBe(200)

    // Success page should reflect the paid state.
    await expect(page.getByRole('heading', { name: /order placed successfully/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(new RegExp(orderNumber))).toBeVisible()

    // Order detail should show the order as paid/processing and expose an invoice link.
    await page.goto(`/orders/${platformOrderId}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /order details/i })).toBeVisible()
    await expect(page.getByText(/paid|processing/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /invoice/i }).first()).toBeVisible()
  })
})
