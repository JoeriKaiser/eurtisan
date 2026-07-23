import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import type { TestOrder } from '../fixtures/orders'
import { createPaidOrder, deleteOrder, getCreatorShop } from '../fixtures/orders'

test.use({ storageState: 'e2e/.auth/creator.json' })

test.describe('creator shipping label generation', () => {
  let order: TestOrder | undefined
  let shopId: string | undefined

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    shopId = shop.id
    order = await createPaidOrder('shipping-label')
  })

  test.afterAll(async () => {
    if (order) {
      await deleteOrder(order)
    }
  })

  test('generates a shipping label when marking an order as shipped', async ({ page }) => {
    if (!order || !shopId) {
      throw new Error('Test order or shop was not created')
    }

    await page.goto(`/studio/${shopId}/orders/${order.shopOrderId}`)
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible()
    await expect(page.locator('[role="status"]').filter({ hasText: 'Paid' })).toBeVisible()

    const shipButton = page.getByRole('button', { name: 'Mark as Shipped' })
    await expect(shipButton).toBeVisible()
    await shipButton.click()

    const shipDialog = page.getByRole('dialog', { name: 'Mark as Shipped' })
    await expect(shipDialog).toBeVisible()

    // The dialog defaults to "Generate Label" mode, which uses the mock Sendcloud
    // provider in the E2E environment so no real external calls are made.
    await shipDialog.getByRole('button', { name: 'Mark as Shipped' }).click()

    await expect(page.locator('[role="status"]').filter({ hasText: 'Shipped' })).toBeVisible({
      timeout: 15000,
    })

    // The shipping label card should now render with carrier and tracking info.
    const labelCard = page.locator('div.bg-surface-default').filter({
      has: page.getByRole('heading', { name: 'Shipping Label' }),
    })
    await expect(labelCard).toBeVisible()
    await expect(labelCard.getByText('Carrier: sendcloud')).toBeVisible()
    await expect(labelCard.getByText(/Tracking:/)).toBeVisible()
    await expect(labelCard.getByRole('link', { name: /download \/ print label/i })).toBeVisible()

    // Verify the label row was persisted in the database.
    const labels = await db
      .select()
      .from(schema.shippingLabel)
      .where(eq(schema.shippingLabel.shopOrderId, order.shopOrderId))
    expect(labels).toHaveLength(1)
    expect(labels[0].carrier).toBe('sendcloud')
    expect(labels[0].trackingNumber).toBeTruthy()
    expect(labels[0].labelUrl).toContain('mock.sendcloud.example.com')

    // The order can now be marked as delivered.
    await page.getByRole('button', { name: 'Mark as Delivered' }).click()
    await expect(page.locator('[role="status"]').filter({ hasText: 'Delivered' })).toBeVisible({
      timeout: 15000,
    })

    await expect(page.getByRole('button', { name: 'Mark as Delivered' })).not.toBeVisible()
  })
})
