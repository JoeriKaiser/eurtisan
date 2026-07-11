import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { E2E_CREATOR } from '../fixtures/auth'
import type { TestOrder } from '../fixtures/orders'
import { createDisputeForOrder, createPaidOrder } from '../fixtures/orders'

let order: TestOrder
let disputeId: string
let notificationId: string
let orderBuyerUserId: string | null = null

test.use({ storageState: 'e2e/.auth/creator.json' })

test.beforeAll(async () => {
  order = await createPaidOrder('dispute-notification')

  const [po] = await db
    .select({ userId: schema.platformOrder.userId })
    .from(schema.platformOrder)
    .where(eq(schema.platformOrder.id, order.platformOrderId))
    .limit(1)
  orderBuyerUserId = po?.userId ?? null

  disputeId = await createDisputeForOrder(order)

  const [creator] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, E2E_CREATOR.email))
    .limit(1)
  if (!creator) throw new Error('Seed creator not found')

  notificationId = randomUUID()
  await db.insert(schema.notification).values({
    id: notificationId,
    userId: creator.id,
    type: 'dispute_opened',
    data: {
      orderNumber: order.orderNumber,
      platformOrderId: order.platformOrderId,
      shopOrderId: order.shopOrderId,
      disputeId,
    },
  })
})

test.afterAll(async () => {
  if (notificationId) {
    await db.delete(schema.notification).where(eq(schema.notification.id, notificationId))
  }
  if (orderBuyerUserId) {
    await db.delete(schema.user).where(eq(schema.user.id, orderBuyerUserId))
  }
})

test.describe('Creator dispute notification deep link', () => {
  test('navigates from the notification list to the dispute detail', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForSelector('html[data-hydrated="true"]')

    const notificationList = page.getByRole('list', { name: /notifications/i })
    await expect(notificationList).toBeVisible()

    const notificationButton = notificationList
      .getByRole('listitem')
      .filter({ hasText: new RegExp(order.orderNumber, 'i') })
      .getByRole('button')
    await expect(notificationButton).toBeVisible()

    await notificationButton.click()

    await page.waitForURL(new RegExp(`/disputes/${disputeId}$`))

    await expect(page.getByRole('heading', { name: /dispute/i })).toBeVisible()
    await expect(page.getByText('The item never arrived.')).toBeVisible()
  })
})
