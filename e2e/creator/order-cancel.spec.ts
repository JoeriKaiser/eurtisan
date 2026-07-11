import { expect, test } from '@playwright/test'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import type { TestOrder } from '../fixtures/orders'
import { createPendingOrder, deleteOrder, getCreatorShop } from '../fixtures/orders'

test.use({ storageState: 'e2e/.auth/creator.json' })

test.describe('Creator order cancellation', () => {
  let order: TestOrder | undefined
  let shopId: string | undefined

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    shopId = shop.id
    order = await createPendingOrder('order-cancel')
  })

  test.afterAll(async () => {
    if (order) {
      await deleteOrder(order)
    }
  })

  test('cancels a pending-payment order and updates the status', async ({ page }) => {
    if (!order || !shopId) {
      throw new Error('Test order or shop was not created')
    }

    await page.goto(`/studio/${shopId}/orders/${order.shopOrderId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()
    await expect(
      page.locator('[role="status"]').filter({ hasText: 'Pending payment' }),
    ).toBeVisible()

    const cancelButton = page.getByRole('button', { name: /cancel order/i })
    await expect(cancelButton).toBeVisible()

    await page.evaluate(() => {
      window.confirm = () => true
    })

    await cancelButton.click()

    await expect(page.locator('[role="status"]').filter({ hasText: 'Cancelled' })).toBeVisible({
      timeout: 15000,
    })

    await expect(page.getByRole('button', { name: /cancel order/i })).not.toBeVisible()
  })
})
