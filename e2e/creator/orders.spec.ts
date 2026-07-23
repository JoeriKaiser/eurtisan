import { waitForAppHydration } from '../fixtures/hydration'
import { expect, type Page, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { getCreatorShop, seedPaidOrders, type TestOrder } from '../fixtures/orders'

const PAGE_SIZE = 20
const TOTAL_ORDERS = PAGE_SIZE + 2
const BUYER_SEED = 'orders-list'

let shopId: string
let orders: TestOrder[] = []

test.describe('creator orders list', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    shopId = shop.id
    orders = await seedPaidOrders(BUYER_SEED, TOTAL_ORDERS)
  })

  test.afterAll(async () => {
    if (orders.length === 0) return
    const platformOrderIds = orders.map((order) => order.platformOrderId)
    await db.delete(schema.platformOrder).where(inArray(schema.platformOrder.id, platformOrderIds))
  })

  test('orders page heading and table render', async ({ page }) => {
    await openOrders(page)

    await expect(page.getByRole('heading', { name: 'Shop Orders' })).toBeVisible()
    await expect(
      page
        .getByRole('link')
        .filter({ hasText: new RegExp(BUYER_SEED) })
        .first(),
    ).toBeVisible()
  })

  test('status filter updates URL and shows only matching orders', async ({ page }) => {
    await openOrders(page)

    const paidOrder = orders[20]
    const processingOrder = orders[1]

    await page.getByLabel('Filter by status').selectOption('paid')
    await page.waitForURL((url) => url.searchParams.get('status') === 'paid')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('link').filter({ hasText: `${paidOrder.shopOrderId.slice(0, 8)}…` }),
    ).toBeVisible()
    await expect(
      page.getByRole('link').filter({ hasText: `${processingOrder.shopOrderId.slice(0, 8)}…` }),
    ).not.toBeVisible()
  })

  test('search filter finds an order by buyer name and shows empty state for no matches', async ({
    page,
  }) => {
    await openOrders(page)

    const searchInput = page.getByLabel('Search orders')
    await searchInput.fill('orders-list')
    await searchInput.press('Enter')
    await page.waitForURL((url) => url.searchParams.get('search') === 'orders-list')
    await page.waitForLoadState('networkidle')

    const newestOrder = orders[orders.length - 1]
    await expect(
      page.getByRole('link').filter({ hasText: `${newestOrder.shopOrderId.slice(0, 8)}…` }),
    ).toBeVisible()

    await searchInput.fill('zzzz-no-match')
    await searchInput.press('Enter')
    await page.waitForURL((url) => url.searchParams.get('search') === 'zzzz-no-match')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No orders match your filters.')).toBeVisible()
  })

  test('pagination shows different orders on page 2', async ({ page }) => {
    await openOrders(page, `?search=${encodeURIComponent('orders-list')}`)

    const pagination = page.getByRole('navigation', { name: 'Order pagination' })
    await expect(pagination).toBeVisible()

    const newestOrderId = `${orders[orders.length - 1].shopOrderId.slice(0, 8)}…`
    await expect(page.getByRole('link').filter({ hasText: newestOrderId })).toBeVisible()

    await pagination.getByRole('button', { name: 'Next' }).click()
    await page.waitForURL((url) => url.searchParams.get('page') === '2')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible()
    await expect(page.getByRole('link').filter({ hasText: newestOrderId })).not.toBeVisible()
  })

  test('clicking an order row navigates to detail and shows the status timeline', async ({
    page,
  }) => {
    await openOrders(page)

    const targetOrder = orders[20] // paid order visible on the first page of the default list
    const row = page
      .getByRole('link')
      .filter({ hasText: `${targetOrder.shopOrderId.slice(0, 8)}…` })
      .first()
    await row.click()

    await page.waitForURL(`/studio/${shopId}/orders/${targetOrder.shopOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: 'Order Detail' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Paid')
    await expect(page.getByText('Fulfillment Timeline')).toBeVisible()
  })
})

async function openOrders(page: Page, query = '') {
  await page.goto(`/studio/${shopId}/orders${query}`)
  await waitForAppHydration(page)
  await dismissAnalyticsConsentBanner(page)
  await page.waitForLoadState('networkidle')
}
