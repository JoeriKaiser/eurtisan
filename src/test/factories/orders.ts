import { randomUUID } from 'node:crypto'
import { db } from '#/db/index'
import * as schema from '#/db/schema'
import { encryptJsonb } from '#/lib/encryption.server'
import {
  makeTestAddress,
  type PlatformOrderLike,
  type ShopLike,
  type UserLike,
} from '#/test/helpers'

function encryptAddress(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === 'string') return value
  return encryptJsonb(value)
}

export async function createPlatformOrder(
  buyer: UserLike | string,
  overrides?: Partial<typeof schema.platformOrder.$inferInsert>,
): Promise<typeof schema.platformOrder.$inferSelect> {
  const userId = typeof buyer === 'string' ? buyer : buyer.id
  const values = {
    userId,
    shippingAddress: makeTestAddress(),
    billingAddress: makeTestAddress(),
    totalCents: 2500,
    status: 'paid' as const,
    ...overrides,
  }
  const [row] = await db
    .insert(schema.platformOrder)
    .values({
      ...values,
      shippingAddress: encryptAddress(values.shippingAddress) as typeof values.shippingAddress,
      billingAddress: encryptAddress(values.billingAddress) as typeof values.billingAddress,
    })
    .returning()
  return row
}

export async function createShopOrder(
  platformOrder: PlatformOrderLike | string,
  shop: ShopLike | string,
  overrides?: Partial<typeof schema.shopOrder.$inferInsert>,
): Promise<typeof schema.shopOrder.$inferSelect> {
  const platformOrderId = typeof platformOrder === 'string' ? platformOrder : platformOrder.id
  const shopId = typeof shop === 'string' ? shop : shop.id
  const [row] = await db
    .insert(schema.shopOrder)
    .values({
      platformOrderId,
      shopId,
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
      status: 'paid',
      ...overrides,
    })
    .returning()
  return row
}

export async function createOrderItem(
  shopOrder: { id: string } | string,
  product: { id: string; name?: string | null; priceCents?: number | null } | string,
  overrides?: Partial<typeof schema.orderItem.$inferInsert>,
): Promise<typeof schema.orderItem.$inferSelect> {
  const shopOrderId = typeof shopOrder === 'string' ? shopOrder : shopOrder.id
  const productId = typeof product === 'string' ? product : product.id
  const productName =
    typeof product === 'string' ? 'Test Product' : (product.name ?? 'Test Product')
  const unitPriceCents = typeof product === 'string' ? 1000 : (product.priceCents ?? 1000)
  const quantity = overrides?.quantity ?? 2
  const [row] = await db
    .insert(schema.orderItem)
    .values({
      shopOrderId,
      productId,
      productName,
      unitPriceCents,
      quantity,
      totalCents: unitPriceCents * quantity,
      ...overrides,
    })
    .returning()
  return row
}

export async function createInventoryReservation(
  product: { id: string } | string,
  overrides?: Partial<typeof schema.inventoryReservation.$inferInsert>,
): Promise<typeof schema.inventoryReservation.$inferSelect> {
  const productId = typeof product === 'string' ? product : product.id
  const [row] = await db
    .insert(schema.inventoryReservation)
    .values({
      productId,
      quantity: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning()
  return row
}

export async function createShippingLabel(
  shopOrder: { id: string } | string,
  overrides?: Partial<typeof schema.shippingLabel.$inferInsert>,
): Promise<typeof schema.shippingLabel.$inferSelect> {
  const shopOrderId = typeof shopOrder === 'string' ? shopOrder : shopOrder.id
  const [row] = await db
    .insert(schema.shippingLabel)
    .values({
      shopOrderId,
      carrier: 'DHL',
      trackingNumber: randomUUID().slice(0, 12).toUpperCase(),
      labelUrl: 'https://example.com/label.pdf',
      ...overrides,
    })
    .returning()
  return row
}
