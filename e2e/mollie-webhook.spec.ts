import { test, expect } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { createPendingOrder, sendMollieWebhook } from './fixtures/orders'
import { db } from './db'
import { invoices, platformOrder, shopOrder } from '../src/db/schema'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Mollie webhook simulation', () => {
  test('success webhook marks the order as paid and creates invoices', async () => {
    const order = await createPendingOrder('webhook-success')

    const response = await sendMollieWebhook(
      baseURL,
      order.molliePaymentId,
      'paid',
      order.totalCents,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string }
    expect(body.status).toBe('processed')

    const [platformOrderRow] = await db
      .select({ status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, order.platformOrderId))
      .limit(1)
    expect(platformOrderRow?.status).toBe('paid')

    const [shopOrderRow] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, order.shopOrderId))
      .limit(1)
    expect(shopOrderRow?.status).toBe('paid')

    const invoiceRows = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.shopOrderId, order.shopOrderId))
    expect(invoiceRows.length).toBeGreaterThanOrEqual(1)
  })

  test('failure webhook marks the order as cancelled and releases stock', async () => {
    const order = await createPendingOrder('webhook-failed')

    const response = await sendMollieWebhook(
      baseURL,
      order.molliePaymentId,
      'failed',
      order.totalCents,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string }
    expect(body.status).toBe('cancelled')

    const [platformOrderRow] = await db
      .select({ status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, order.platformOrderId))
      .limit(1)
    expect(platformOrderRow?.status).toBe('cancelled')

    const [shopOrderRow] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, order.shopOrderId))
      .limit(1)
    expect(shopOrderRow?.status).toBe('cancelled')
  })
})
