import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { createPendingCheckoutOrder } from '../fixtures/checkout'
import { sendMollieWebhook } from '../fixtures/orders'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Order success polling', () => {
  test('polls a pending payment and updates to paid after the webhook arrives', async ({
    page,
  }) => {
    const { platformOrderId, mockPaymentId } = await createPendingCheckoutOrder(page)

    // The success page should initially show the pending-payment state.
    await expect(page.getByRole('heading', { name: /confirming payment/i })).toBeVisible()

    // Simulate Mollie confirming the payment.
    const webhookResponse = await sendMollieWebhook(
      process.env.BASE_URL || 'http://localhost:3000',
      mockPaymentId,
      'paid',
    )
    expect(webhookResponse.status).toBe(200)

    // The page polls every 3 seconds; wait for it to reflect the paid status.
    await expect(page.getByRole('heading', { name: /order placed successfully/i })).toBeVisible({
      timeout: 15000,
    })

    // Navigate to the order detail to confirm the platform order is actually paid.
    await page.goto(`/orders/${platformOrderId}`)
    await waitForAppHydration(page)
    await expect(page.getByText(/paid/i).first()).toBeVisible()
  })
})
