import { eq, inArray } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  account,
  auditLog,
  cart,
  dispute,
  disputeMessage,
  invoices,
  notification,
  payoutReconciliationLog,
  platformOrder,
  product,
  review,
  session,
  shop,
  twoFactor,
  user,
} from '#/db/schema'

import { clearTestTables } from '#/test/cleanup'
import {
  createAccount,
  createAuditLog,
  createCart,
  createCartItem,
  createDispute,
  createDisputeMessage,
  createInvoice,
  createNotification,
  createPayout,
  createPayoutReconciliationLog,
  createPlatformOrder,
  createProduct,
  createReview,
  createSession,
  createShop,
  createShopOrder,
  createTwoFactor,
  createUser,
} from '#/test/factories'

import { deleteUserAccount, exportUserData } from './account-data.server'

beforeEach(async () => {
  await clearTestTables()
})

async function seedShop(ownerId: string, overrides?: Parameters<typeof createShop>[1]) {
  return createShop(ownerId, {
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
}

async function seedPayoutLog(shopId: string, payload: Record<string, unknown>) {
  const p = await createPayout(shopId, { amountCents: 4500, status: 'sent' })
  return createPayoutReconciliationLog(p, { event: 'route_missing', payload })
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
    const u = await createUser({ deletedAt: new Date() })
    await expect(deleteUserAccount(u.id)).rejects.toThrow('USER_NOT_FOUND')
  })

  it('throws when user is an admin', async () => {
    const u = await createUser({ role: 'admin' })
    await expect(deleteUserAccount(u.id)).rejects.toThrow('ADMIN_DELETE_FORBIDDEN')
  })

  it('anonymizes the user profile', async () => {
    const u = await createUser({ name: 'Jane Doe', email: 'jane@example.com' })

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
    const u = await createUser({ role: 'creator' })
    const activeShop = await seedShop(u.id, { status: 'active' })
    const draftShop = await seedShop(u.id, { status: 'draft' })
    const productA = await createProduct(activeShop.id)
    const productB = await createProduct(draftShop.id)

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
    const u = await createUser()
    const order = await createPlatformOrder(u.id)

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
    const owner = await createUser({ role: 'creator' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(platformOrderRecord, s)
    const invoice = await createInvoice(so)

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
    const owner = await createUser({ role: 'creator' })
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
    const u = await createUser({ role: 'creator' })
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
    const u = await createUser()
    await createAuditLog(u, {
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
    const u = await createUser()
    const owner = await createUser({ role: 'creator', email: 'owner@example.com' })
    const s = await seedShop(owner.id)
    const p = await createProduct(s.id)
    const platformOrderRecord = await createPlatformOrder(u)
    const so = await createShopOrder(platformOrderRecord, s)

    await createSession(u, { expiresAt: new Date(Date.now() + 86_400_000) })
    await createAccount(u, { accountId: 'acc', providerId: 'email' })
    await createTwoFactor(u, { secret: 'secret', backupCodes: 'codes' })
    await createNotification(u, { type: 'welcome', data: {} })
    const cartRecord = await createCart(u)
    await createCartItem(cartRecord, p, { quantity: 1 })
    await createReview(so, p, u, { rating: 5, comment: 'Great!' })
    const disputeRecord = await createDispute(so, u, {
      reason: 'damaged',
      description: 'It arrived broken.',
      status: 'open',
    })
    await createDisputeMessage(disputeRecord, u, { message: 'Please help.' })

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
    const u = await createUser()

    await deleteUserAccount(u.id)

    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.deletedAt).toBeInstanceOf(Date)
  })
})
