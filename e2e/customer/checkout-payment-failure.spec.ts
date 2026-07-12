/**
 * Payment terminal failure states.
 *
 * Mollie maps expired/failed/cancelled payments to the platform order status
 * `cancelled`. The success page polls while pending; after the webhook it
 * should display the payment-failed UI.
 *
 * Environment assumptions:
 * - Uses the shared `e2e/.auth/customer.json` customer.
 * - Relies on `completeCheckout` (single-shop cart, first shipping option).
 */

import { test, expect } from '@playwright/test'
import { addFirstProductToCart, emptyCart } from '../fixtures/cart'
import { completeCheckout } from '../fixtures/checkout'
import { sendMollieWebhook } from '../fixtures/orders'

test.use({ storageState: 'e2e/.auth/customer.json' })

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

const failureUiByStatus = {
  cancelled: { heading: /payment cancelled/i, message: /you cancelled the payment/i },
  failed: { heading: /payment failed/i, message: /your payment could not be processed/i },
  expired: { heading: /payment expired/i, message: /your payment session expired/i },
} as const

test.describe('Checkout payment failure states', () => {
  for (const paymentStatus of ['cancelled', 'failed', 'expired'] as const) {
    test(`displays payment failed UI after a ${paymentStatus} webhook`, async ({ page }) => {
      await emptyCart(page)
      await addFirstProductToCart(page)

      const { mockPaymentId } = await completeCheckout(page)

      // The success page is polling while the order is pending_payment.
      await expect(page.getByRole('heading', { name: /confirming payment/i })).toBeVisible()

      const webhookResponse = await sendMollieWebhook(baseURL, mockPaymentId, paymentStatus)
      expect(webhookResponse.status).toBe(200)

      // The page should update via polling and show the failure state.
      const { heading, message } = failureUiByStatus[paymentStatus]
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText(message)).toBeVisible()
    })
  }
})
