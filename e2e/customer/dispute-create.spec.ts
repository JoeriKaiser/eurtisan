import { waitForAppHydration } from '../fixtures/hydration'
import { test, expect } from '@playwright/test'
import { createDeliveredOrder, getDisputeIdForShopOrder } from '../fixtures/orders'

let order: Awaited<ReturnType<typeof createDeliveredOrder>>

test.beforeAll(async () => {
  order = await createDeliveredOrder('customer')
})

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Customer-initiated dispute', () => {
  test('opens a dispute from the order detail and lands on the dispute thread', async ({
    page,
  }) => {
    await page.goto(`/orders/${order.platformOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /order details/i })).toBeVisible()

    const openDisputeButton = page.getByRole('button', { name: /open dispute/i })
    await expect(openDisputeButton).toBeVisible()
    await openDisputeButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: /open a dispute/i })).toBeVisible()

    await dialog.locator('textarea').fill('The package was empty when it arrived.')
    await dialog.getByRole('button', { name: /submit dispute/i }).click()

    // The order detail should reflect the new disputed state.
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(/disputed/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /open dispute/i })).not.toBeVisible()

    const disputeId = await getDisputeIdForShopOrder(order.shopOrderId)
    expect(disputeId).toBeTruthy()

    await page.goto(`/disputes/${disputeId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /dispute/i })).toBeVisible()
    await expect(page.getByText('The package was empty when it arrived.')).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })
})
