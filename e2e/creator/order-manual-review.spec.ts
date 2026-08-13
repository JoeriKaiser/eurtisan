import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { deleteCustomerByEmail } from '../fixtures/customers'
import type { TestOrder } from '../fixtures/orders'
import { createPaidOrder, getCreatorShop } from '../fixtures/orders'

test.describe('creator manual review resolution', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  const createdOrders: Array<TestOrder & { customerEmail: string }> = []

  async function createManualReviewOrder(seed: string) {
    const order = await createPaidOrder(seed)

    await db
      .update(schema.shopOrder)
      .set({ status: 'manual_review', updatedAt: new Date() })
      .where(eq(schema.shopOrder.id, order.shopOrderId))

    createdOrders.push({ ...order, customerEmail: `e2e-${seed}@eurtisan.local` })
    return order
  }

  test.afterAll(async () => {
    const shopOrderIds = createdOrders.map((o) => o.shopOrderId)
    const platformOrderIds = createdOrders.map((o) => o.platformOrderId)
    const customerEmails = new Set(createdOrders.map((o) => o.customerEmail))

    if (shopOrderIds.length === 0) return

    // Remove invoices first so the self-referencing credit-note FK is handled
    // before the parent shop order rows are deleted.
    await db.delete(schema.invoices).where(inArray(schema.invoices.shopOrderId, shopOrderIds))
    await db.delete(schema.orderItem).where(inArray(schema.orderItem.shopOrderId, shopOrderIds))
    await db.delete(schema.shopOrder).where(inArray(schema.shopOrder.id, shopOrderIds))
    await db.delete(schema.platformOrder).where(inArray(schema.platformOrder.id, platformOrderIds))

    for (const email of customerEmails) {
      await deleteCustomerByEmail(email)
    }
  })

  test('creator can resolve manual review to paid', async ({ page }) => {
    const shop = await getCreatorShop()
    const order = await createManualReviewOrder('manual-review-paid')

    await page.goto(`/studio/${shop.id}/orders/${order.shopOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()
    await expect(page.locator('[role="status"]').filter({ hasText: 'Manual review' })).toBeVisible()

    await page.getByRole('button', { name: 'Resolve Review' }).click()
    await expect(page.getByRole('heading', { name: 'Resolve Manual Review' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve and mark paid' })).toBeVisible()

    // The default resolution is already 'paid', so resolve immediately.
    await page.getByRole('button', { name: 'Resolve', exact: true }).click()

    await expect(page.locator('[role="status"]').filter({ hasText: 'Paid' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Resolve Manual Review' })).not.toBeVisible()
  })

  test('creator can resolve manual review to cancelled with refund warning', async ({ page }) => {
    const shop = await getCreatorShop()
    const order = await createManualReviewOrder('manual-review-cancelled')

    await page.goto(`/studio/${shop.id}/orders/${order.shopOrderId}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()
    await expect(page.locator('[role="status"]').filter({ hasText: 'Manual review' })).toBeVisible()

    await page.getByRole('button', { name: 'Resolve Review' }).click()
    await expect(page.getByRole('heading', { name: 'Resolve Manual Review' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel order' }).click()
    await expect(
      page.getByText(
        'Cancelling will fully refund the buyer, including shipping, and restock the items.',
      ),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Resolve', exact: true }).click()

    await expect(page.locator('[role="status"]').filter({ hasText: 'Cancelled' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Resolve Manual Review' })).not.toBeVisible()
  })
})
