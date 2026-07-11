import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { createDeliveredOrder } from '../fixtures/orders'

test.describe('creator disputes', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test('creator can view dispute detail and reply to the message thread', async ({ page }) => {
    // 1. Create a delivered order
    const order = await createDeliveredOrder('dispute-test')

    // 2. Fetch the buyer user ID from the platform order
    const [po] = await db
      .select({ userId: schema.platformOrder.userId })
      .from(schema.platformOrder)
      .where(eq(schema.platformOrder.id, order.platformOrderId))
      .limit(1)
    if (!po) throw new Error('Platform order not found')

    // 3. Mark the shop order status as 'disputed'
    await db
      .update(schema.shopOrder)
      .set({ status: 'disputed', updatedAt: new Date() })
      .where(eq(schema.shopOrder.id, order.shopOrderId))

    // 4. Seed a dispute record in the database
    const disputeId = randomUUID()
    await db.insert(schema.dispute).values({
      id: disputeId,
      shopOrderId: order.shopOrderId,
      buyerUserId: po.userId,
      reason: 'Item not received',
      description: 'The package was marked as shipped but never arrived at my address.',
      status: 'open',
    })

    // 5. Navigate directly to the dispute thread as the creator
    await page.goto(`/disputes/${disputeId}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    // Verify dispute details page loads
    await expect(page.getByRole('heading', { name: 'Dispute' })).toBeVisible()
    await expect(page.getByText('Item not received')).toBeVisible()

    // 6. Send a message in the dispute chat thread
    const testMessage = 'Hello, we are checking this shipment status with our carrier.'
    await page.getByPlaceholder('Write a message...').fill(testMessage)
    await page.getByRole('button', { name: 'Send' }).click()

    // 7. Verify the message is posted and displayed
    await expect(page.getByText(testMessage)).toBeVisible()
  })
})
