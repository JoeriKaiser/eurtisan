/**
 * E2E order fixtures — creates deterministic orders against the isolated E2E
 * database so specs can focus on UI assertions instead of seed data archaeology.
 */
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../../src/db/schema'
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
        inArray(schema.shop.status, ['active', 'approved']),
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

export async function getTestProduct(shopId: string) {
  const product = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.shopId, shopId))
    .limit(1)
  if (!product[0]) throw new Error('No product found for test shop')
  return product[0]
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
    .returning()

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

export async function createDeliveredOrder(buyerSeed: string): Promise<TestOrder> {
  const order = await createPaidOrder(buyerSeed)

  await db
    .update(schema.shopOrder)
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
      updatedAt: new Date(),
      disputeWindowExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(schema.shopOrder.id, order.shopOrderId))

  return order
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
