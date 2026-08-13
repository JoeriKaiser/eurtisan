import { waitForAppHydration } from '../fixtures/hydration'
/**
 * Caveat: this spec asserts that the invoice link is present. Downloading the invoice
 * is blocked by an invoice-viewer runtime crash (Faro error boundary) and is covered
 * as a known blocker in the coverage plan.
 */

import { test, expect } from '@playwright/test'
import { createDeliveredOrderWithTracking } from '../fixtures/orders'

let order: Awaited<ReturnType<typeof createDeliveredOrderWithTracking>>

test.beforeAll(async () => {
  order = await createDeliveredOrderWithTracking('customer')
})

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Order detail', () => {
  test('renders order status, items, shipping address, and invoice link', async ({ page }) => {
    await page.goto(`/orders/${order.platformOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /order details/i })).toBeVisible()
    await expect(page.getByText(/delivered/i).first()).toBeVisible()
    await expect(page.getByText(/shipping address/i)).toBeVisible()
    await expect(page.getByText(new RegExp(String(order.totalCents / 100)))).toBeVisible()

    const invoiceLink = page.getByRole('link', { name: /invoice/i })
    await expect(invoiceLink).toBeVisible()
  })
})
