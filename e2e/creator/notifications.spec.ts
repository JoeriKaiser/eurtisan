import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { E2E_CREATOR } from '../fixtures/auth'

test.describe('Creator notifications', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  const notificationIds: string[] = []

  test.afterAll(async () => {
    for (const id of notificationIds) {
      await db.delete(schema.notification).where(eq(schema.notification.id, id))
    }
  })

  test('renders the notifications list, shows the unread badge, and supports mark all as read', async ({
    page,
  }) => {
    // Fetch the seeded creator account so we can create a deterministic notification.
    const [creator] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, E2E_CREATOR.email))
      .limit(1)
    if (!creator) throw new Error('Seed creator not found')

    // Seed one unread notification directly. Order creation does not reliably
    // emit a notification in this test path, so we guarantee the row ourselves.
    const notificationId = randomUUID()
    await db.insert(schema.notification).values({
      id: notificationId,
      userId: creator.id,
      type: 'order_placed',
      data: { orderNumber: 'E2E-NOTIF-TEST' },
    })
    notificationIds.push(notificationId)

    await page.goto('/notifications')
    await page.waitForSelector('html[data-hydrated="true"]')

    // The notifications list should render with at least one item.
    const notificationList = page.getByRole('list', { name: /notifications/i })
    await expect(notificationList).toBeVisible()
    const firstItem = notificationList.getByRole('listitem').first()
    await expect(firstItem).toBeVisible()

    // The header should show an unread badge for the creator.
    const headerBadge = page.getByLabel(/unread notifications/i)
    await expect(headerBadge).toBeVisible()

    // Unread notifications show an accent dot.
    const unreadDot = firstItem.locator('span.rounded-full.bg-accent-primary')
    await expect(unreadDot).toBeVisible()

    // Mark every notification as read.
    const markAllReadButton = page.getByRole('button', { name: /mark all as read/i })
    await expect(markAllReadButton).toBeVisible()
    await markAllReadButton.click()

    // The header badge should clear once all notifications are read.
    await expect(headerBadge).not.toBeVisible()

    // The unread dot should disappear and the item should be styled as read.
    await expect(firstItem.locator('span.rounded-full.bg-accent-primary')).toHaveCount(0)
    const firstButton = firstItem.getByRole('button')
    await expect(firstButton).toHaveClass(/border-l-transparent|bg-bg-inset/)
  })
})
