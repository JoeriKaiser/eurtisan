import { db } from '#/db/index'
import * as schema from '#/db/schema'
import type { ShopLike, ShopOrderLike } from '#/test/helpers'

export async function createPayout(
  shop: ShopLike | string,
  overrides?: Partial<typeof schema.payout.$inferInsert>,
): Promise<typeof schema.payout.$inferSelect> {
  const shopId = typeof shop === 'string' ? shop : shop.id
  const [row] = await db
    .insert(schema.payout)
    .values({
      shopId,
      amountCents: 5000,
      status: 'pending',
      ...overrides,
    })
    .returning()
  return row
}

export async function createInvoice(
  shopOrder: ShopOrderLike | string,
  overrides?: Partial<typeof schema.invoices.$inferInsert>,
): Promise<typeof schema.invoices.$inferSelect> {
  const shopOrderId = typeof shopOrder === 'string' ? shopOrder : shopOrder.id
  const [row] = await db
    .insert(schema.invoices)
    .values({
      shopOrderId,
      invoiceNumber: `INV-${Date.now()}`,
      type: 'customer',
      billingDetails: {},
      ...overrides,
    })
    .returning()
  return row
}
