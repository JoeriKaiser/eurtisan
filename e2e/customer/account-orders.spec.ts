import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { seedPaidOrders } from '../fixtures/orders'

const PAGE_SIZE = 10
const TOTAL_ORDERS = PAGE_SIZE + 2

let orders: Awaited<ReturnType<typeof seedPaidOrders>> = []

test.beforeAll(async () => {
  // Create enough paid orders for the authenticated E2E customer to trigger pagination.
  orders = await seedPaidOrders('customer', TOTAL_ORDERS)
})

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Account orders list', () => {
  test('lists orders and supports pagination', async ({ page }) => {
    await page.goto('/account/orders')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible()
    await expect(
      page.getByText(/paid|processing|shipped|delivered|completed/i).first(),
    ).toBeVisible()

    // Pagination appears because we seeded more than one page of orders.
    const pagination = () => page.locator('nav').filter({ hasText: /page \d+ of \d+/i })
    await expect(pagination()).toBeVisible()
    await expect(pagination().getByText(/page 1 of \d+/i)).toBeVisible()

    // Page 1 should list the newest order we just created.
    const newestOrderNumber = orders[orders.length - 1].orderNumber
    await expect(page.getByText(newestOrderNumber)).toBeVisible()

    // Navigate to page 2 and assert it shows a different page of results.
    const nextButton = pagination().getByRole('button', { name: /next/i })
    await expect(nextButton).toBeEnabled()
    await nextButton.click()
    await page.waitForURL(/[?&]page=2/)
    await expect(pagination().getByText(/page 2 of \d+/i)).toBeVisible()
    await expect(page.getByText(newestOrderNumber)).not.toBeVisible()

    // Return to the first page.
    await pagination()
      .getByRole('button', { name: /previous/i })
      .click()
    await page.waitForURL((url) => {
      const pageParam = url.searchParams.get('page')
      return pageParam === null || pageParam === '1'
    })
    await expect(pagination().getByText(/page 1 of \d+/i)).toBeVisible()
    await expect(page.getByText(newestOrderNumber)).toBeVisible()
  })
})
