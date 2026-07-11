/**
 * E2E order fixtures — creates deterministic orders against the isolated E2E
 * database so specs can focus on UI assertions instead of seed data archaeology.
 */
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { and, eq, isNotNull } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { E2E_CUSTOMER } from './auth'

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  })
  return `${salt}:${key.toString('hex')}`
}

export interface TestCustomer {
  id: string
  email: string
  password: string
  name: string
}

export interface TestOrder {
  platformOrderId: string
  orderNumber: string
  shopOrderId: string
  shopId: string
  productId: string
  molliePaymentId: string
  totalCents: number
  invoiceNumber?: string
}

export async function createTestCustomer(seed: string): Promise<TestCustomer> {
  if (seed === 'customer') {
    const existing = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, E2E_CUSTOMER.email))
      .limit(1)
    if (!existing[0]) {
      throw new Error(`Standard E2E customer ${E2E_CUSTOMER.email} not found; run seed.`)
    }
    return {
      id: existing[0].id,
      email: E2E_CUSTOMER.email,
      password: E2E_CUSTOMER.password,
      name: existing[0].name ?? E2E_CUSTOMER.displayName,
    }
  }

  const email = `e2e-${seed}@eurtisan.local`
  const password = 'test-password-123'
  const name = `E2E Customer ${seed}`

  const existing = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1)
  if (existing[0]) {
    return { id: existing[0].id, email, password, name }
  }

  const id = randomUUID()
  await db.insert(schema.user).values({
    id,
    name,
    email,
    emailVerified: true,
    role: 'customer',
  })
  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hashPassword(password),
  })
  return { id, email, password, name }
}

export async function getCreatorShop() {
  const creator = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, 'creator@eurtisan.local'))
    .limit(1)
  if (!creator[0]) throw new Error('Seed creator user not found')

  const shop = await db
    .select()
    .from(schema.shop)
    .where(
      and(
        eq(schema.shop.ownerId, creator[0].id),
        eq(schema.shop.status, 'active'),
        eq(schema.shop.isSuspended, false),
      ),
    )
    .limit(1)
  if (!shop[0]) throw new Error('Seed creator shop not found')

  const origin = (shop[0].shippingOrigin ?? {}) as Record<string, unknown>
  const completeOrigin = {
    street: typeof origin.street === 'string' ? origin.street : '42 Rue de Rivoli',
    city: typeof origin.city === 'string' ? origin.city : 'Paris',
    postalCode: typeof origin.postalCode === 'string' ? origin.postalCode : '75001',
    country: typeof origin.country === 'string' ? origin.country : 'France',
  }

  if (
    origin.street !== completeOrigin.street ||
    origin.city !== completeOrigin.city ||
    origin.postalCode !== completeOrigin.postalCode ||
    origin.country !== completeOrigin.country
  ) {
    await db
      .update(schema.shop)
      .set({ shippingOrigin: completeOrigin })
      .where(eq(schema.shop.id, shop[0].id))
    return { ...shop[0], shippingOrigin: completeOrigin }
  }

  return shop[0]
}

export async function getTestProduct(shopId: string, stockCount = 999) {
  const product = await db
    .select()
    .from(schema.product)
    .where(
      and(
        eq(schema.product.shopId, shopId),
        eq(schema.product.status, 'published'),
        eq(schema.product.isActive, true),
        isNotNull(schema.product.slug),
      ),
    )
    .limit(1)
  if (!product[0]) throw new Error('No published active product found for test shop')

  await db.update(schema.product).set({ stockCount }).where(eq(schema.product.id, product[0].id))

  product[0].stockCount = stockCount
  return product[0]
}

export async function getShopProductWithReviews(shopId: string) {
  const reviewed = await db
    .select({ productId: schema.review.productId })
    .from(schema.review)
    .innerJoin(schema.product, eq(schema.review.productId, schema.product.id))
    .where(
      and(
        eq(schema.product.shopId, shopId),
        eq(schema.product.status, 'published'),
        eq(schema.product.isActive, true),
        eq(schema.review.moderationStatus, 'approved'),
      ),
    )
    .groupBy(schema.review.productId)
    .limit(1)
  if (!reviewed[0]) throw new Error('No reviewed product found for test shop')

  const product = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.id, reviewed[0].productId))
    .limit(1)
  if (!product[0]) throw new Error('Reviewed product not found')

  return product[0]
}

export async function setProductStock(productId: string, stockCount: number): Promise<void> {
  process.env.DATABASE_URL = e2eDatabaseUrl
  await db.update(schema.product).set({ stockCount }).where(eq(schema.product.id, productId))
}

function makeAddress() {
  return {
    name: 'E2E Buyer',
    street: '42 Avenue des Champs-Élysées',
    city: 'Paris',
    postalCode: '75008',
    country: 'France',
  }
}

export async function createPendingOrder(buyerSeed: string): Promise<TestOrder> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  const customer = await createTestCustomer(buyerSeed)
  const shop = await getCreatorShop()
  const product = await getTestProduct(shop.id)

  const quantity = 1
  const unitPriceCents = product.priceCents
  const subtotalCents = unitPriceCents * quantity
  const shippingCostCents = 500
  const totalCents = subtotalCents + shippingCostCents
  const molliePaymentId = `tr_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const address = makeAddress()

  const [platformOrder] = await db
    .insert(schema.platformOrder)
    .values({
      userId: customer.id,
      shippingAddress: address,
      billingAddress: address,
      totalCents,
      status: 'pending_payment',
      molliePaymentId,
    })
    .returning({ id: schema.platformOrder.id, orderNumber: schema.platformOrder.orderNumber })

  const [shopOrder] = await db
    .insert(schema.shopOrder)
    .values({
      platformOrderId: platformOrder.id,
      shopId: shop.id,
      shippingMethod: 'standard',
      shippingCostCents,
      subtotalCents,
      vatAmountCents: 0,
      status: 'pending_payment',
    })
    .returning()

  await db.insert(schema.orderItem).values({
    shopOrderId: shopOrder.id,
    productId: product.id,
    productName: product.name,
    unitPriceCents,
    quantity,
    totalCents: subtotalCents,
    vatRateBasisPoints: 0,
    vatAmountCents: 0,
    weightGrams: product.weightGrams ?? 100,
    lengthCm: product.lengthCm ?? 10,
    widthCm: product.widthCm ?? 10,
    heightCm: product.heightCm ?? 10,
  })

  return {
    platformOrderId: platformOrder.id,
    orderNumber: platformOrder.orderNumber,
    shopOrderId: shopOrder.id,
    shopId: shop.id,
    productId: product.id,
    molliePaymentId,
    totalCents,
  }
}

export async function markOrderPaid(testOrder: TestOrder): Promise<string> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  await db
    .update(schema.platformOrder)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(eq(schema.platformOrder.id, testOrder.platformOrderId))

  await db
    .update(schema.shopOrder)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(eq(schema.shopOrder.id, testOrder.shopOrderId))

  const { createInvoicesForPlatformOrder } = await import('../../src/lib/invoices.server')
  const created = await createInvoicesForPlatformOrder(testOrder.platformOrderId)
  const numbers = created.get(testOrder.shopOrderId)
  if (!numbers) {
    throw new Error(`No invoice numbers created for shop order ${testOrder.shopOrderId}`)
  }
  return numbers.customerInvoiceNumber
}

export async function createPaidOrder(buyerSeed: string): Promise<TestOrder> {
  const order = await createPendingOrder(buyerSeed)
  const invoiceNumber = await markOrderPaid(order)
  return { ...order, invoiceNumber }
}

/**
 * Create many orders for the same buyer without generating invoices.
 * Useful for pagination/order-list specs where only the count matters.
 * Orders are given varied statuses, totals, and dates so the list is visually diverse.
 */
export async function seedPaidOrders(
  buyerSeed: string,
  count: number,
): Promise<Awaited<ReturnType<typeof createPaidOrder>>[]> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  const customer = await createTestCustomer(buyerSeed)
  const shop = await getCreatorShop()
  const product = await getTestProduct(shop.id)

  const shippingCostCents = 500
  const unitPriceCents = product.priceCents
  const baseAddress = makeAddress()
  const now = Date.now()
  const orders: Awaited<ReturnType<typeof createPaidOrder>>[] = []

  const statuses = ['paid', 'processing', 'shipped', 'delivered'] as const

  for (let i = 0; i < count; i++) {
    const status = statuses[i % statuses.length]
    const quantity = (i % 3) + 1
    const subtotalCents = unitPriceCents * quantity
    const totalCents = subtotalCents + shippingCostCents
    // Spread orders across multiple days so row dates differ.
    const createdAt = new Date(now - (count - i) * 24 * 60 * 60 * 1000)
    const molliePaymentId = `tr_e2e_${now}_${i}_${Math.random().toString(36).slice(2, 8)}`

    const [platformOrder] = await db
      .insert(schema.platformOrder)
      .values({
        userId: customer.id,
        shippingAddress: baseAddress,
        billingAddress: baseAddress,
        totalCents,
        status,
        molliePaymentId,
        createdAt,
      })
      .returning({ id: schema.platformOrder.id, orderNumber: schema.platformOrder.orderNumber })

    const [shopOrder] = await db
      .insert(schema.shopOrder)
      .values({
        platformOrderId: platformOrder.id,
        shopId: shop.id,
        shippingMethod: 'standard',
        shippingCostCents,
        subtotalCents,
        vatAmountCents: 0,
        status,
        createdAt,
      })
      .returning({ id: schema.shopOrder.id })

    await db.insert(schema.orderItem).values({
      shopOrderId: shopOrder.id,
      productId: product.id,
      productName: product.name,
      unitPriceCents,
      quantity,
      totalCents: subtotalCents,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      weightGrams: product.weightGrams ?? 100,
      lengthCm: product.lengthCm ?? 10,
      widthCm: product.widthCm ?? 10,
      heightCm: product.heightCm ?? 10,
      createdAt,
    })

    orders.push({
      platformOrderId: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      shopOrderId: shopOrder.id,
      shopId: shop.id,
      productId: product.id,
      molliePaymentId,
      totalCents,
    })
  }

  return orders
}

export async function createDeliveredOrder(buyerSeed: string): Promise<TestOrder> {
  const order = await createPaidOrder(buyerSeed)

  // Set deliveredAt far enough in the past that items are eligible for review.
  const deliveredAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)

  await db
    .update(schema.shopOrder)
    .set({
      status: 'delivered',
      deliveredAt,
      updatedAt: new Date(),
      disputeWindowExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(schema.shopOrder.id, order.shopOrderId))

  return order
}

export async function createShippedOrder(buyerSeed: string): Promise<TestOrder> {
  const order = await createPaidOrder(buyerSeed)

  await db
    .update(schema.shopOrder)
    .set({
      status: 'shipped',
      updatedAt: new Date(),
    })
    .where(eq(schema.shopOrder.id, order.shopOrderId))

  return order
}

export async function createDeliveredOrderWithTracking(
  buyerSeed: string,
  trackingNumber = 'TRACK-E2E-123456',
  trackingUrl = 'https://carrier.example/track/TRACK-E2E-123456',
): Promise<TestOrder> {
  const order = await createDeliveredOrder(buyerSeed)

  await db
    .update(schema.shopOrder)
    .set({
      trackingNumber,
      trackingUrl,
      trackingHistory: [
        {
          status: 'label_created',
          timestamp: new Date().toISOString(),
        },
        {
          status: 'in_transit',
          timestamp: new Date().toISOString(),
        },
      ],
      updatedAt: new Date(),
    })
    .where(eq(schema.shopOrder.id, order.shopOrderId))

  await db.insert(schema.shippingLabel).values({
    id: randomUUID(),
    shopOrderId: order.shopOrderId,
    carrier: 'sendcloud',
    trackingNumber,
    labelUrl: 'https://example.com/label.pdf',
    externalParcelId: `parcel-${Date.now()}`,
  })

  return order
}

export async function createReviewableOrder(buyerSeed: string): Promise<TestOrder> {
  return createDeliveredOrder(buyerSeed)
}

export async function getProductById(productId: string) {
  process.env.DATABASE_URL = e2eDatabaseUrl

  const [product] = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.id, productId))
    .limit(1)
  if (!product) throw new Error(`Product ${productId} not found`)
  return product
}

export async function getDisputeIdForShopOrder(shopOrderId: string): Promise<string | null> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  const [row] = await db
    .select({ id: schema.dispute.id })
    .from(schema.dispute)
    .where(eq(schema.dispute.shopOrderId, shopOrderId))
    .limit(1)
  return row?.id ?? null
}

export async function createDisputeForOrder(
  order: TestOrder,
  reason = 'item_not_received',
  description = 'The item never arrived.',
): Promise<string> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  const existing = await db
    .select({ id: schema.dispute.id })
    .from(schema.dispute)
    .where(eq(schema.dispute.shopOrderId, order.shopOrderId))
    .limit(1)
  if (existing[0]) return existing[0].id

  const customer = await createTestCustomer('customer')
  const [disputeRow] = await db
    .insert(schema.dispute)
    .values({
      shopOrderId: order.shopOrderId,
      buyerUserId: customer.id,
      reason,
      description,
      status: 'open',
    })
    .returning({ id: schema.dispute.id })

  await db
    .update(schema.shopOrder)
    .set({ status: 'disputed', updatedAt: new Date() })
    .where(eq(schema.shopOrder.id, order.shopOrderId))

  return disputeRow.id
}

export async function sendMollieWebhook(
  baseURL: string,
  paymentId: string,
  status: 'paid' | 'expired' | 'failed' | 'cancelled' = 'paid',
  amountCents?: number,
): Promise<Response> {
  // Configure the mock provider so getPaymentStatus returns the desired status.
  await fetch(`${baseURL}/api/e2e/mock-payment-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId, status, amountCents }),
  })

  const signature = `mock_sig_${paymentId}`
  return fetch(`${baseURL}/api/webhooks/mollie`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mollie-Signature': signature,
    },
    body: JSON.stringify({ id: paymentId }),
  })
}

export async function deleteOrder(order: TestOrder): Promise<void> {
  process.env.DATABASE_URL = e2eDatabaseUrl

  // Deleting the platform order cascades to the shop order, order items,
  // inventory reservations, payouts, invoices, disputes, and shipping labels.
  await db.delete(schema.platformOrder).where(eq(schema.platformOrder.id, order.platformOrderId))
}
