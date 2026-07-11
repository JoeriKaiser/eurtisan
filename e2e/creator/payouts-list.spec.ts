import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { deleteCustomerByEmail } from '../fixtures/customers'
import type { TestOrder } from '../fixtures/orders'
import { createDeliveredOrder, createPaidOrder, getCreatorShop } from '../fixtures/orders'

test.describe('creator payouts list', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })
  test.describe.configure({ mode: 'serial' })

  const customerSeed = 'payouts-list'
  const customerEmail = `e2e-${customerSeed}@eurtisan.local`
  let shopId: string
  let pendingOrder: TestOrder
  let inTransitOrder: TestOrder

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    shopId = shop.id

    pendingOrder = await createDeliveredOrder(customerSeed)

    inTransitOrder = await createPaidOrder(customerSeed)
    await db
      .update(schema.shopOrder)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(schema.shopOrder.id, inTransitOrder.shopOrderId))
  })

  test.afterAll(async () => {
    await deleteCustomerByEmail(customerEmail)
  })

  test('renders payouts page heading and table', async ({ page }) => {
    await page.goto(`/creator/payouts?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    await expect(page.getByRole('heading', { name: 'Payouts', exact: true })).toBeVisible()
    await expect(page.locator('table')).toBeVisible()
    await expect(
      page.locator('tbody tr').filter({ hasText: pendingOrder.shopOrderId.slice(0, 8) }),
    ).toBeVisible()
  })

  test('status filter updates the list', async ({ page }) => {
    await page.goto(`/creator/payouts?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)
    await page.waitForLoadState('networkidle')

    const pendingRow = page
      .locator('tbody tr')
      .filter({ hasText: pendingOrder.shopOrderId.slice(0, 8) })
    const inTransitRow = page
      .locator('tbody tr')
      .filter({ hasText: inTransitOrder.shopOrderId.slice(0, 8) })

    await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    await expect(pendingRow).toBeVisible()
    await expect(inTransitRow).toBeVisible()

    const pendingTab = page.getByRole('tab', { name: 'Pending' })
    await expect(pendingTab).toBeVisible()
    await pendingTab.click()
    await page.waitForURL(/[?&]status=pending(&|$)/)
    await expect(page.getByRole('tab', { name: 'Pending' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(pendingRow).toBeVisible()
    await expect(inTransitRow).toHaveCount(0)

    const inTransitTab = page.getByRole('tab', { name: 'In Transit' })
    await expect(inTransitTab).toBeVisible()
    await inTransitTab.click()
    await page.waitForURL(/[?&]status=in_transit(&|$)/)
    await expect(page.getByRole('tab', { name: 'In Transit' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(inTransitRow).toBeVisible()
    await expect(pendingRow).toHaveCount(0)
  })

  test('payout row invoice link navigates to the invoice page', async ({ page }) => {
    await page.goto(`/creator/payouts?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    const row = page.locator('tbody tr').filter({ hasText: pendingOrder.shopOrderId.slice(0, 8) })
    const customerLink = row.getByRole('link', { name: 'Customer' })
    await expect(customerLink).toBeVisible()

    await customerLink.click()
    const invoiceNumber = pendingOrder.invoiceNumber
    if (!invoiceNumber) throw new Error('pendingOrder.invoiceNumber is required for invoice link test')
    await page.waitForURL(`/invoices/${invoiceNumber}`)
    await expect(page.getByRole('heading', { name: 'INVOICE', exact: true })).toBeVisible()
    await expect(page.getByText(invoiceNumber).first()).toBeVisible()
  })

  test('disconnect button opens confirmation dialog when present', async ({ page }) => {
    await page.goto(`/creator/payouts?shopId=${shopId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)

    const disconnectButton = page.getByRole('button', { name: 'Disconnect account' })
    if ((await disconnectButton.count()) === 0) {
      test.skip(true, 'No disconnect button present for the active shop')
      return
    }

    await disconnectButton.click()
    await expect(page.getByRole('heading', { name: 'Disconnect Mollie account?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Disconnect Mollie account?' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Disconnect account' })).toBeVisible()
  })
})
