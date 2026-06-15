import { beforeEach, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'

import { db } from '#/db/index'
import {
  account,
  auditLog,
  cart,
  cartItem,
  dispute,
  disputeMessage,
  invoices,
  notification,
  orderItem,
  payout,
  payoutReconciliationLog,
  platformOrder,
  product,
  review,
  session,
  shop,
  shopOrder,
  twoFactor,
  user,
} from '#/db/schema'

import { deleteUserAccount, exportUserData } from './account-data.server'

beforeEach(async () => {
  await db.delete(auditLog)
  await db.delete(payoutReconciliationLog)
  await db.delete(payout)
  await db.delete(invoices)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(disputeMessage)
  await db.delete(dispute)
  await db.delete(review)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(notification)
  await db.delete(session)
  await db.delete(account)
  await db.delete(twoFactor)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  const [u] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Test User',
      email: `user-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
  return u
}

async function seedShop(ownerId: string, overrides?: Partial<typeof shop.$inferInsert>) {
  const [s] = await db
    .insert(shop)
    .values({
      id: crypto.randomUUID(),
      name: 'Test Shop',
      slug: `shop-${crypto.randomUUID().slice(0, 8)}`,
      ownerId,
      status: 'active',
      businessAddress: {
        name: 'Owner',
        street: '1 Rue de Paris',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
      shippingOrigin: {
        name: 'Owner',
        street: '1 Rue de Paris',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
      ...overrides,
    })
    .returning()
  return s
}

async function seedProduct(shopId: string, overrides?: Partial<typeof product.$inferInsert>) {
  const [p] = await db
    .insert(product)
    .values({
      id: crypto.randomUUID(),
      name: 'Test Product',
      slug: `product-${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      isActive: true,
      priceCents: 1000,
      ...overrides,
    })
    .returning()
  return p
}

async function seedPlatformOrder(
  buyerId: string,
  overrides?: Partial<typeof platformOrder.$inferInsert>,
) {
  const [o] = await db
    .insert(platformOrder)
    .values({
      userId: buyerId,
      shippingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      billingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      totalCents: 10000,
      status: 'paid',
      ...overrides,
    })
    .returning()
  return o
}

async function seedShopOrder(
  platformOrderId: string,
  shopId: string,
  overrides?: Partial<typeof shopOrder.$inferInsert>,
) {
  const [so] = await db
    .insert(shopOrder)
    .values({
      platformOrderId,
      shopId,
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 5000,
      status: 'delivered',
      ...overrides,
    })
    .returning()
  return so
}

async function seedInvoice(shopOrderId: string, billingDetails?: Record<string, string>) {
  const [i] = await db
    .insert(invoices)
    .values({
      invoiceNumber: `INV-${crypto.randomUUID().slice(0, 8)}`,
      type: 'customer',
      shopOrderId,
      billingDetails: billingDetails ?? {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      totalCents: 5000,
    })
    .returning()
  return i
}

async function seedPayoutLog(shopId: string, payload: Record<string, unknown>) {
  const [p] = await db
    .insert(payout)
    .values({
      shopId,
      amountCents: 4500,
      status: 'sent',
    })
    .returning()

  const [log] = await db
    .insert(payoutReconciliationLog)
    .values({
      payoutId: p.id,
      event: 'route_missing',
      payload,
    })
    .returning()

  return log
}

describe('exportUserData', () => {
  it('throws when user does not exist', async () => {
    await expect(exportUserData('nonexistent-user-id')).rejects.toThrow('USER_NOT_FOUND')
  })
})

describe('deleteUserAccount', () => {
  it('throws when user does not exist', async () => {
    await expect(deleteUserAccount('nonexistent-user-id')).rejects.toThrow('USER_NOT_FOUND')
  })

  it('throws when user is already deleted', async () => {
    const u = await seedUser({ deletedAt: new Date() })
    await expect(deleteUserAccount(u.id)).rejects.toThrow('USER_NOT_FOUND')
  })

  it('throws when user is an admin', async () => {
    const u = await seedUser({ role: 'admin' })
    await expect(deleteUserAccount(u.id)).rejects.toThrow('ADMIN_DELETE_FORBIDDEN')
  })

  it('anonymizes the user profile', async () => {
    const u = await seedUser({ name: 'Jane Doe', email: 'jane@example.com' })

    await deleteUserAccount(u.id)

    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.name).toBe('Deleted User')
    expect(updated?.email).toBe(`deleted-${u.id}@${'anonymized.eurtisan.invalid'}`)
    expect(updated?.deletedAt).toBeInstanceOf(Date)
    expect(updated?.image).toBeNull()
    expect(updated?.emailVerified).toBe(false)
    expect(updated?.twoFactorEnabled).toBe(false)
  })

  it('archives all owned shops and deactivates their products', async () => {
    const u = await seedUser({ role: 'creator' })
    const activeShop = await seedShop(u.id, { status: 'active' })
    const draftShop = await seedShop(u.id, { status: 'draft' })
    const productA = await seedProduct(activeShop.id)
    const productB = await seedProduct(draftShop.id)

    await deleteUserAccount(u.id)

    const shops = await db.select().from(shop).where(eq(shop.ownerId, u.id))
    for (const s of shops) {
      expect(s.status).toBe('archived')
      expect(s.archivedAt).toBeInstanceOf(Date)
      expect(s.scheduledDeleteAt).toBeNull()
    }

    const products = await db
      .select()
      .from(product)
      .where(inArray(product.id, [productA.id, productB.id]))
    for (const p of products) {
      expect(p.isActive).toBe(false)
    }
  })

  it('redacts platform order addresses', async () => {
    const u = await seedUser()
    const order = await seedPlatformOrder(u.id)

    await deleteUserAccount(u.id)

    const updated = await db.query.platformOrder.findFirst({
      where: eq(platformOrder.id, order.id),
    })
    expect(updated?.shippingAddress).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
    expect(updated?.billingAddress).toEqual(updated?.shippingAddress)
  })

  it('redacts invoice billing details for owned shops', async () => {
    const owner = await seedUser({ role: 'creator' })
    const buyer = await seedUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await seedPlatformOrder(buyer.id)
    const so = await seedShopOrder(platformOrderRecord.id, s.id)
    const invoice = await seedInvoice(so.id)

    await deleteUserAccount(owner.id)

    const updated = await db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) })
    expect(updated?.billingDetails).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
  })

  it('redacts payout reconciliation log payloads for owned shops', async () => {
    const owner = await seedUser({ role: 'creator' })
    const s = await seedShop(owner.id)
    const log = await seedPayoutLog(s.id, {
      buyerName: 'Alice',
      buyerEmail: 'alice@example.com',
      amount: 100,
      nested: {
        shippingAddress: { street: 'Secret St', city: 'Secret City' },
        billingAddress: { street: 'Secret St', city: 'Secret City' },
        name: 'Alice',
        email: 'alice@example.com',
        safeField: 'keep',
      },
      address: '123 Private Lane',
    })

    await deleteUserAccount(owner.id)

    const updated = await db.query.payoutReconciliationLog.findFirst({
      where: eq(payoutReconciliationLog.id, log.id),
    })
    const payload = updated?.payload as Record<string, unknown>
    expect(payload.buyerName).toBe('[redacted]')
    expect(payload.buyerEmail).toBe('[redacted]')
    expect(payload.address).toBe('[redacted]')
    expect(payload.amount).toBe(100)
    expect(payload.nested).toEqual({
      shippingAddress: {
        name: 'Deleted User',
        street: '[redacted]',
        city: '[redacted]',
        postalCode: '[redacted]',
        country: 'XX',
      },
      billingAddress: {
        name: 'Deleted User',
        street: '[redacted]',
        city: '[redacted]',
        postalCode: '[redacted]',
        country: 'XX',
      },
      name: '[redacted]',
      email: '[redacted]',
      safeField: 'keep',
    })
  })

  it('redacts shop business and shipping addresses', async () => {
    const u = await seedUser({ role: 'creator' })
    const s = await seedShop(u.id)

    await deleteUserAccount(u.id)

    const updated = await db.query.shop.findFirst({ where: eq(shop.id, s.id) })
    expect(updated?.businessAddress).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
    expect(updated?.shippingOrigin).toEqual(updated?.businessAddress)
  })

  it('sets audit log actor name to Deleted User while keeping actor id', async () => {
    const u = await seedUser()
    await db.insert(auditLog).values({
      actorId: u.id,
      actorName: u.name,
      action: 'shop.suspend',
      resourceType: 'shop',
      resourceId: 'shop-1',
      metadata: {},
    })

    await deleteUserAccount(u.id)

    const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, u.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorName).toBe('Deleted User')
    expect(rows[0]?.actorId).toBe(u.id)
  })

  it('removes sessions, accounts, two factor, notifications, carts, and redacts reviews/disputes', async () => {
    const u = await seedUser()
    const owner = await seedUser({ role: 'creator', email: 'owner@example.com' })
    const s = await seedShop(owner.id)
    const p = await seedProduct(s.id, { id: 'prod-1' })
    const platformOrderRecord = await seedPlatformOrder(u.id)
    const so = await seedShopOrder(platformOrderRecord.id, s.id)

    await db.insert(session).values({
      id: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: u.id,
    })
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: 'acc',
      providerId: 'email',
      userId: u.id,
    })
    await db.insert(twoFactor).values({
      id: crypto.randomUUID(),
      userId: u.id,
      secret: 'secret',
      backupCodes: 'codes',
    })
    await db.insert(notification).values({
      userId: u.id,
      type: 'welcome',
      data: {},
    })
    const [cartRecord] = await db.insert(cart).values({ userId: u.id }).returning()
    await db.insert(cartItem).values({ cartId: cartRecord.id, productId: p.id, quantity: 1 })
    await db.insert(review).values({
      shopOrderId: so.id,
      buyerUserId: u.id,
      productId: p.id,
      rating: 5,
      comment: 'Great!',
    })
    const [disputeRecord] = await db
      .insert(dispute)
      .values({
        buyerUserId: u.id,
        shopOrderId: so.id,
        reason: 'damaged',
        description: 'It arrived broken.',
        status: 'open',
      })
      .returning()
    await db.insert(disputeMessage).values({
      disputeId: disputeRecord.id,
      senderUserId: u.id,
      message: 'Please help.',
    })

    await deleteUserAccount(u.id)

    expect(await db.query.session.findFirst({ where: eq(session.userId, u.id) })).toBeUndefined()
    expect(await db.query.account.findFirst({ where: eq(account.userId, u.id) })).toBeUndefined()
    expect(
      await db.query.twoFactor.findFirst({ where: eq(twoFactor.userId, u.id) }),
    ).toBeUndefined()
    expect(
      await db.query.notification.findFirst({ where: eq(notification.userId, u.id) }),
    ).toBeUndefined()
    expect(await db.query.cart.findFirst({ where: eq(cart.userId, u.id) })).toBeUndefined()

    const reviewRows = await db.select().from(review).where(eq(review.buyerUserId, u.id))
    expect(reviewRows[0]?.comment).toBeNull()

    const disputeRows = await db.select().from(dispute).where(eq(dispute.buyerUserId, u.id))
    expect(disputeRows[0]?.description).toBe('[redacted — account deleted]')

    const disputeMessageRows = await db
      .select()
      .from(disputeMessage)
      .where(eq(disputeMessage.senderUserId, u.id))
    expect(disputeMessageRows[0]?.message).toBe('[message removed — account deleted]')
  })

  it('marks the user so subsequent auth checks reject them', async () => {
    const u = await seedUser()

    await deleteUserAccount(u.id)

    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.deletedAt).toBeInstanceOf(Date)
  })
})
