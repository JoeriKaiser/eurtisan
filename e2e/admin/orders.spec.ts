import { waitForAppHydration } from '../fixtures/hydration'
import { expect, type Page, test } from '@playwright/test'
import {
  createPaidOrder,
  createPendingOrder,
  deleteOrder,
  type TestOrder,
} from '../fixtures/orders'

const SEED = `admin-orders-${Date.now()}`
const BUYER_NAME = `E2E Customer ${SEED}`

let paidOrder: TestOrder
let pendingOrder: TestOrder

async function openOrders(page: Page) {
  await page.goto('/admin/orders')
  await waitForAppHydration(page)
}

test.describe('admin orders', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    paidOrder = await createPaidOrder(SEED)
    pendingOrder = await createPendingOrder(`${SEED}-pending`)
  })

  test.afterAll(async () => {
    await deleteOrder(paidOrder)
    await deleteOrder(pendingOrder)
  })

  test('admin orders list renders', async ({ page }) => {
    await openOrders(page)
    await expect(page.getByRole('heading', { name: 'Order Inspector' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('admin can search orders by order number', async ({ page }) => {
    await openOrders(page)
    const searchInput = page.getByRole('textbox', {
      name: 'Search by order ID, buyer name, or email…',
    })
    await searchInput.fill(paidOrder.orderNumber)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.waitForFunction(
      (orderNumber) => new URL(window.location.href).searchParams.get('query') === orderNumber,
      paidOrder.orderNumber,
    )

    await expect(page.getByRole('link', { name: paidOrder.orderNumber })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('link', { name: pendingOrder.orderNumber })).toHaveCount(0)
  })

  test('admin can filter orders by status', async ({ page }) => {
    await openOrders(page)

    await page.getByRole('button', { name: 'paid' }).click()
    await page.waitForFunction(() => {
      const raw = new URL(window.location.href).searchParams.get('statuses')
      if (!raw) return false
      try {
        return (JSON.parse(raw) as string[]).includes('paid')
      } catch {
        return false
      }
    })
    await page.waitForFunction(
      ({ expected, excluded }) => {
        const table = document.querySelector('table')
        if (!table) return false
        const text = table.textContent ?? ''
        return text.includes(expected) && !text.includes(excluded)
      },
      { expected: paidOrder.orderNumber, excluded: pendingOrder.orderNumber },
    )
    await expect(page.getByRole('link', { name: paidOrder.orderNumber })).toBeVisible()
    await expect(page.getByRole('link', { name: pendingOrder.orderNumber })).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get('statuses') === '[]',
    )
    await page.waitForFunction(
      ({ paid, pending }) => {
        const table = document.querySelector('table')
        if (!table) return false
        const text = table.textContent ?? ''
        return text.includes(paid) && text.includes(pending)
      },
      { paid: paidOrder.orderNumber, pending: pendingOrder.orderNumber },
    )

    await page.getByRole('button', { name: 'pending payment' }).click()
    await page.waitForFunction(() => {
      const raw = new URL(window.location.href).searchParams.get('statuses')
      if (!raw) return false
      try {
        return (JSON.parse(raw) as string[]).includes('pending_payment')
      } catch {
        return false
      }
    })
    await page.waitForFunction(
      ({ expected, excluded }) => {
        const table = document.querySelector('table')
        if (!table) return false
        const text = table.textContent ?? ''
        return text.includes(expected) && !text.includes(excluded)
      },
      { expected: pendingOrder.orderNumber, excluded: paidOrder.orderNumber },
    )
    await expect(page.getByRole('link', { name: pendingOrder.orderNumber })).toBeVisible()
    await expect(page.getByRole('link', { name: paidOrder.orderNumber })).toHaveCount(0)
  })

  test('admin can navigate to order detail', async ({ page }) => {
    await openOrders(page)
    await page.getByRole('link', { name: paidOrder.orderNumber }).click()
    await page.waitForURL(`/admin/orders/${paidOrder.platformOrderId}`)

    await expect(page.getByRole('heading', { name: 'Order Inspection' })).toBeVisible()
    await expect(page.getByText(paidOrder.orderNumber)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Buyer' })).toBeVisible()
    await expect(page.getByText(BUYER_NAME)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Shop Orders' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible()
  })

  test('export CSV button downloads orders', async ({ page }) => {
    await openOrders(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
