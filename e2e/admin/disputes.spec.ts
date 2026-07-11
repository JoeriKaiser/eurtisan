import { expect, test } from '@playwright/test'
import type { TestOrder } from '../fixtures/orders'
import {
  createDeliveredOrder,
  createDisputeForOrder,
  createPaidOrder,
  deleteOrder,
} from '../fixtures/orders'

const createdOrders: TestOrder[] = []

test.afterAll(async () => {
  for (const order of createdOrders) {
    await deleteOrder(order)
  }
})

test.describe('admin dispute management', () => {
  test('admin disputes list renders', async ({ page }) => {
    const seed = `disputes-list-${Date.now()}`
    const order = await createDeliveredOrder(seed)
    createdOrders.push(order)
    await createDisputeForOrder(order, 'item_not_received', 'The item never arrived.')

    await page.goto('/admin/disputes')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /Dispute/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('admin can filter disputes by status', async ({ page }) => {
    const withDisputeSeed = `disputes-filter-with-${Date.now()}`
    const withoutDisputeSeed = `disputes-filter-without-${Date.now()}`

    const orderWithDispute = await createDeliveredOrder(withDisputeSeed)
    createdOrders.push(orderWithDispute)
    const disputeId = await createDisputeForOrder(
      orderWithDispute,
      'not_as_described',
      'Item does not match description.',
    )

    const orderWithoutDispute = await createDeliveredOrder(withoutDisputeSeed)
    createdOrders.push(orderWithoutDispute)

    await page.goto('/admin/disputes')
    await page.waitForSelector('html[data-hydrated="true"]')

    const disputeRow = page.locator('tr').filter({ hasText: disputeId.slice(0, 8) })

    await expect(page.getByRole('tab', { name: /open/i, selected: true })).toBeVisible()
    await expect(disputeRow).toBeVisible()

    await page.getByRole('tab', { name: /resolved/i }).click()
    await expect(page.getByRole('tab', { name: /resolved/i, selected: true })).toBeVisible()
    await expect(disputeRow).toHaveCount(0)

    await page.getByRole('tab', { name: /open/i }).click()
    await expect(page.getByRole('tab', { name: /open/i, selected: true })).toBeVisible()
    await expect(disputeRow).toBeVisible()
  })

  test('admin can view dispute detail', async ({ page }) => {
    const seed = `disputes-detail-${Date.now()}`
    const order = await createDeliveredOrder(seed)
    createdOrders.push(order)
    const disputeId = await createDisputeForOrder(order, 'damaged', 'Item arrived damaged.')

    await page.goto('/admin/disputes')
    await page.waitForSelector('html[data-hydrated="true"]')

    const disputeRow = page.locator('tr').filter({ hasText: disputeId.slice(0, 8) })
    await expect(disputeRow).toBeVisible()
    await disputeRow.getByRole('link', { name: /view/i }).click()

    await page.waitForURL(/\/admin\/disputes\/[^/]+/)
    await expect(page.getByRole('heading', { name: /Dispute Damaged/i })).toBeVisible()
    await expect(page.getByText('Item arrived damaged.')).toBeVisible()
    await expect(page.getByText(order.shopOrderId.slice(0, 8))).toBeVisible()
  })

  test('admin can send a message in a dispute', async ({ page }) => {
    const seed = `disputes-message-${Date.now()}`
    const order = await createDeliveredOrder(seed)
    createdOrders.push(order)
    const disputeId = await createDisputeForOrder(
      order,
      'other',
      'Buyer is asking for clarification.',
    )

    await page.goto(`/admin/disputes/${disputeId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /Dispute Other/i })).toBeVisible()

    const message = `Admin follow-up message ${Date.now()}`
    await page.getByRole('textbox', { name: /admin message/i }).fill(message)
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText(message)).toBeVisible()
  })

  test('admin can resolve a dispute with full refund', async ({ page }) => {
    const seed = `disputes-refund-${Date.now()}`
    const order = await createPaidOrder(seed)
    createdOrders.push(order)
    const disputeId = await createDisputeForOrder(
      order,
      'item_not_received',
      'Buyer never received the item.',
    )

    await page.goto(`/admin/disputes/${disputeId}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: /Dispute Item not received/i })).toBeVisible()

    await page.getByLabel(/resolution/i).selectOption('full_refund')
    await page.getByRole('button', { name: /submit resolution/i }).click()

    await expect(page.getByText(/resolved/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Full refund/i)).toBeVisible()
    await expect(page.getByText(/Refund: €[\d,.]+/)).toBeVisible()
  })
})
