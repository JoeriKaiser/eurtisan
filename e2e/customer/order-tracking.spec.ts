import { test, expect } from '@playwright/test'
import { createDeliveredOrderWithTracking } from '../fixtures/orders'

let order: Awaited<ReturnType<typeof createDeliveredOrderWithTracking>>

test.beforeAll(async () => {
  order = await createDeliveredOrderWithTracking('customer')
})

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Order tracking', () => {
  test('displays tracking number and carrier tracking link', async ({ page }) => {
    await page.goto(`/orders/${order.platformOrderId}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByText(/TRACK-E2E-123456/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /track package/i })).toBeVisible()
  })
})
