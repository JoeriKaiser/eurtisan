import { test, expect } from '@playwright/test'
import { createPaidOrder } from './fixtures/orders'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Buyer invoice download', () => {
  test('views the customer invoice for a paid order', async ({ page }) => {
    const order = await createPaidOrder('invoice')

    await page.goto(`/orders/${order.platformOrderId}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()

    const invoiceLink = page.getByRole('link', { name: /invoice/i })
    await expect(invoiceLink).toBeVisible()

    await invoiceLink.click()
    await page.waitForURL(/\/invoices\/INV-/)

    await expect(page.getByRole('heading', { name: /invoice/i })).toBeVisible()
    await expect(page.getByText(`INV-${order.shopOrderId.toUpperCase()}`)).toBeVisible()
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible()
  })
})
