import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { deleteCustomerByEmail } from '../fixtures/customers'
import { createPaidOrder, type TestOrder } from '../fixtures/orders'

function amountRegex(cents: number): RegExp {
  const formatted = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
  return new RegExp(formatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

test.describe('admin payouts', () => {
  test.describe.configure({ mode: 'serial' })

  const seed = `payouts-${Date.now()}`
  const customerEmail = `e2e-${seed}@eurtisan.local`
  const orders: TestOrder[] = []
  const payoutsToDelete: string[] = []

  test.afterAll(async () => {
    // Payout rows are explicitly deleted first; deleting their parent orders
    // below also cascades to payouts, so this is defensive cleanup.
    for (const payoutId of payoutsToDelete) {
      await db.delete(schema.payout).where(eq(schema.payout.id, payoutId))
    }

    for (const order of orders) {
      await db
        .delete(schema.platformOrder)
        .where(eq(schema.platformOrder.id, order.platformOrderId))
    }

    orders.length = 0
    payoutsToDelete.length = 0

    await deleteCustomerByEmail(customerEmail)
  })

  async function createTestPayout(
    status: 'pending' | 'sent',
    options: {
      markDelivered?: boolean
      expiredDisputeWindow?: boolean
      createdAt?: Date
    } = {},
  ) {
    const order = await createPaidOrder(seed)
    orders.push(order)

    if (options.markDelivered) {
      await db
        .update(schema.shopOrder)
        .set({
          status: 'delivered',
          deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          disputeWindowExpiresAt: options.expiredDisputeWindow
            ? new Date(Date.now() - 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .where(eq(schema.shopOrder.id, order.shopOrderId))
    }

    const createdAt = options.createdAt ?? new Date()
    // Use a unique amount per payout so every test row can be reliably located
    // even when other payouts for the same creator exist in the list.
    const amountCents = Number(Date.now() % 100_000_000)

    const [payoutRow] = await db
      .insert(schema.payout)
      .values({
        shopOrderId: order.shopOrderId,
        shopId: order.shopId,
        amountCents,
        status,
        createdAt,
      })
      .returning({ id: schema.payout.id })

    payoutsToDelete.push(payoutRow.id)

    return { order, payoutId: payoutRow.id, amountCents }
  }

  test('admin payouts page renders', async ({ page }) => {
    await page.goto('/admin/payouts')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: 'Payout Oversight' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'History' })).toBeVisible()
  })

  test('pending payouts tab lists pending payouts', async ({ page }) => {
    const { amountCents } = await createTestPayout('pending', { createdAt: new Date('2024-01-01') })

    await page.goto('/admin/payouts?tab=pending&pageSize=100')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = page.locator('tbody tr').filter({ hasText: amountRegex(amountCents) })
    await expect(row).toBeVisible()
    await expect(row.getByRole('button', { name: 'Send Payout' })).toBeVisible()
  })

  test('history tab lists processed payouts', async ({ page }) => {
    const { amountCents } = await createTestPayout('sent')

    await page.goto('/admin/payouts?tab=history&pageSize=100')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = page.locator('tbody tr').filter({ hasText: amountRegex(amountCents) })
    await expect(row).toBeVisible()
    await expect(row.getByText('Sent')).toBeVisible()
  })

  test('admin can execute a pending payout', async ({ page }) => {
    const { payoutId, amountCents } = await createTestPayout('pending', {
      markDelivered: true,
      expiredDisputeWindow: true,
      createdAt: new Date('2024-01-01'),
    })

    await page.goto('/admin/payouts?tab=pending&pageSize=100')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = page.locator('tbody tr').filter({ hasText: amountRegex(amountCents) })
    await expect(row.getByRole('button', { name: 'Send Payout' })).toBeVisible()

    await row.getByRole('button', { name: 'Send Payout' }).click()

    await expect(page.getByText('Payout has been sent.')).toBeVisible()

    const [payout] = await db
      .select({ status: schema.payout.status })
      .from(schema.payout)
      .where(eq(schema.payout.id, payoutId))
      .limit(1)
    expect(payout?.status).toBe('sent')
  })

  test('export CSV works', async ({ page }) => {
    await createTestPayout('sent', { createdAt: new Date() })

    await page.goto('/admin/payouts?tab=history&pageSize=100')
    await page.waitForSelector('html[data-hydrated="true"]')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^payouts-.*\.csv$/)
  })
})
