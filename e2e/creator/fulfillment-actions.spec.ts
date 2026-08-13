import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { createPaidOrder, getCreatorShop } from '../fixtures/orders'

test.describe('creator fulfillment and financial actions', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test('creator can refund a paid order', async ({ page }) => {
    const shop = await getCreatorShop()
    const order = await createPaidOrder('refund-flow')

    await page.goto(`/studio/${shop.id}/orders/${order.shopOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()
    await expect(page.getByText(/paid/i).first()).toBeVisible()

    // Mock confirm dialog for refund action
    await page.evaluate(() => {
      window.confirm = () => true
    })

    // Click refund order button
    await page.getByRole('button', { name: /refund order/i }).click()

    // Verify order status transitions to Refunded
    await expect(page.locator('[role="status"]').filter({ hasText: 'Refunded' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('creator can complete Mollie Connect onboarding and view connection status', async ({
    page,
  }) => {
    test.skip(
      !process.env.MOLLIE_CLIENT_ID || !process.env.MOLLIE_CLIENT_SECRET,
      'Mollie Connect credentials not configured; skip this test in the current environment.',
    )

    const shop = await getCreatorShop()

    // Navigate to Creator Payouts page
    await page.goto(`/creator/payouts?shopId=${shop.id}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible()

    // Wait for connect or disconnect button to be visible (ensures page has finished loading/hydrating connection state)
    const connectBtn = page.getByRole('button', { name: /connect with mollie/i })
    const disconnectBtn = page.getByRole('button', { name: /disconnect account/i })
    await expect(connectBtn.or(disconnectBtn)).toBeVisible({ timeout: 15000 })

    // Disconnect if already connected to start with a fresh slate
    if (await disconnectBtn.isVisible()) {
      await disconnectBtn.click()
      await expect(connectBtn).toBeVisible({ timeout: 15000 })
    }

    // Click Connect with Mollie button
    await connectBtn.click()

    // Wait for redirect to mock Mollie OAuth screen
    await page.waitForURL(/\/mollie-mock-oauth/)
    await waitForAppHydration(page)
    await expect(page.getByRole('heading', { name: /authorize eurtisan/i })).toBeVisible()

    // Click Authorize Access button
    await page.getByRole('button', { name: /authorize access/i }).click()

    // Verify redirect back to Payouts page and connection status shows Connected
    await page.waitForURL(/\/creator\/payouts/)
    await waitForAppHydration(page)
    await expect(page.getByText('Connected').first()).toBeVisible({ timeout: 15000 })
  })
})
