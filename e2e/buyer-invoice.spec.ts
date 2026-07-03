import { test, expect } from '@playwright/test'
import { createPaidOrder } from './fixtures/orders'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Buyer invoice download', () => {
  test('views the customer invoice for a paid order', async ({ page }) => {
    const order = await createPaidOrder('customer')
    if (!order.invoiceNumber) throw new Error('Invoice number missing from test order')

    await page.goto(`/account/orders/${order.orderNumber}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /order details/i })).toBeVisible()

    const invoiceLink = page.getByRole('link', { name: /invoice/i })
    await expect(invoiceLink).toBeVisible()

    await invoiceLink.click()
    await page.waitForURL(`/invoices/${order.invoiceNumber}`)

    await expect(page.getByRole('heading', { name: /invoice/i }).first()).toBeVisible()
    await expect(page.getByText(order.invoiceNumber).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible()
  })
})
