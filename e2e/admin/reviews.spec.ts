import { expect, type Locator, type Page, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { deleteCustomerByEmail } from '../fixtures/customers'
import {
  createReviewableOrder,
  createTestCustomer,
  deleteOrder,
  type TestOrder,
} from '../fixtures/orders'

test.describe('admin review moderation', () => {
  const created: Array<{ reviewId: string; order: TestOrder; buyerEmail: string }> = []

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test.afterAll(async () => {
    for (const { reviewId, order, buyerEmail } of created) {
      if (reviewId) {
        await db
          .delete(schema.review)
          .where(eq(schema.review.id, reviewId))
          .catch(() => {})
      }
      await deleteOrder(order).catch(() => {})
      await deleteCustomerByEmail(buyerEmail).catch(() => {})
    }
    created.length = 0
  })

  async function seedReview(status: 'approved' | 'flagged' | 'hidden') {
    const seed = `admin-reviews-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const buyer = await createTestCustomer(seed)
    const order = await createReviewableOrder(seed)
    const comment = `E2E review ${seed}`

    const [reviewRow] = await db
      .insert(schema.review)
      .values({
        shopOrderId: order.shopOrderId,
        productId: order.productId,
        buyerUserId: buyer.id,
        rating: 4,
        comment,
        moderationStatus: status,
      })
      .returning({ id: schema.review.id })

    created.push({ reviewId: reviewRow.id, order, buyerEmail: buyer.email })
    return { reviewId: reviewRow.id, order, comment, buyer }
  }

  function findReviewRow(page: Page, comment: string): Locator {
    return page.locator('table tbody tr').filter({ hasText: comment })
  }

  test('admin reviews list renders', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: 'Review Moderation' })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('admin can filter reviews by status', async ({ page }) => {
    const { comment } = await seedReview('flagged')

    await page.goto('/admin/reviews')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = findReviewRow(page, comment)

    await page.getByRole('button', { name: 'All' }).click()
    await expect(row).toBeVisible()

    await page.getByRole('button', { name: 'Flagged' }).click()
    await expect(row).toBeVisible()

    await page.getByRole('button', { name: 'Approved' }).click()
    await expect(row).toHaveCount(0)

    await page.getByRole('button', { name: 'Hidden' }).click()
    await expect(row).toHaveCount(0)
  })

  test('admin can flag a review', async ({ page }) => {
    const { comment } = await seedReview('approved')

    await page.goto('/admin/reviews')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = findReviewRow(page, comment)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Flag' }).click()

    await expect(row.locator('span').filter({ hasText: 'Flagged' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Flag' })).toHaveCount(0)
  })

  test('admin can hide a review', async ({ page }) => {
    const { comment } = await seedReview('flagged')

    await page.goto('/admin/reviews')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = findReviewRow(page, comment)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Hide' }).click()

    await expect(row.locator('span').filter({ hasText: 'Hidden' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Hide' })).toHaveCount(0)
  })

  test('admin can approve a review', async ({ page }) => {
    const { comment } = await seedReview('hidden')

    await page.goto('/admin/reviews')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = findReviewRow(page, comment)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Approve' }).click()

    await expect(row.locator('span').filter({ hasText: 'Approved' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  })
})
