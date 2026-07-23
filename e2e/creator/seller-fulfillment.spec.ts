import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { createPaidOrder, getCreatorShop } from '../fixtures/orders'

test.use({ storageState: 'e2e/.auth/creator.json' })

test.describe('Seller fulfillment flow', () => {
  test('ships an order, edits tracking, and marks it as delivered', async ({ page }) => {
    const shop = await getCreatorShop()
    const order = await createPaidOrder('fulfillment')

    await page.goto(`/studio/${shop.id}/orders/${order.shopOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()
    await expect(page.getByText(/paid/i).first()).toBeVisible()

    // Generate a shipping label and mark as shipped.
    await page.getByRole('button', { name: /mark as shipped/i }).click()
    const shipDialog = page.getByRole('dialog', { name: /mark as shipped/i })
    await expect(shipDialog).toBeVisible()
    await shipDialog.getByRole('button', { name: /mark as shipped/i }).click()

    await expect(page.locator('[role="status"]').filter({ hasText: 'Shipped' })).toBeVisible({
      timeout: 15000,
    })

    // Edit tracking information.
    await page.getByRole('button', { name: /edit tracking/i }).click()
    await page.getByLabel(/tracking number/i).fill('TRACK-E2E-123456')
    await page.getByLabel(/tracking url/i).fill('https://carrier.example/track/TRACK-E2E-123456')
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText('TRACK-E2E-123456')).toBeVisible()

    // Mark the order as delivered.
    await page.getByRole('button', { name: /mark as delivered/i }).click()
    await expect(page.locator('[role="status"]').filter({ hasText: 'Delivered' })).toBeVisible({
      timeout: 15000,
    })
  })
})
