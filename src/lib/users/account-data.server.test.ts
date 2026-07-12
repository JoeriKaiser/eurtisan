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
  userEmailPreference,
} from '#/db/schema'
import { hashEmail } from '#/lib/customers.server'

import { clearTestTables } from '#/test/cleanup'
import {
  createAccount,
  createAuditLog,
  createCart,
  createCartItem,
  createCustomerNote,
  createCustomerTag,
  createDispute,
  createDisputeMessage,
  createInvoice,
  createNotification,
  createOwnerMessage,
  createOwnerMessageThread,
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

import { decryptJsonb } from '#/lib/encryption.server'

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

async function seedPayoutLog(
  shop: { id: string },
  shopOrder: { id: string },
  payload: Record<string, unknown>,
) {
  const p = await createPayout(shop.id, {
    shopOrderId: shopOrder.id,
    amountCents: 4500,
    status: 'sent',
  })
  return createPayoutReconciliationLog(p, { event: 'route_missing', payload })
}

describe('exportUserData', () => {
  it('throws when user does not exist', async () => {
    await expect(exportUserData('nonexistent-user-id')).rejects.toThrow('USER_NOT_FOUND')
  })

  it('includes user profile, shops, platform orders, and reviews', async () => {
    const u = await createUser({ name: 'Jane Doe', email: 'jane@example.com' })
    const s = await seedShop(u.id)
    const order = await createPlatformOrder(u.id)
    const productA = await createProduct(s.id)
    const so = await createShopOrder(order, s)
    await createReview(so, productA, u, { rating: 5, comment: 'Great!' })

    const data = await exportUserData(u.id)

    expect(data.user.id).toBe(u.id)
    expect(data.user.email).toBe('jane@example.com')
    expect(data.shops).toHaveLength(1)
    expect(data.shops[0]?.id).toBe(s.id)
    expect(data.platformOrders).toHaveLength(1)
    expect(data.platformOrders[0]?.id).toBe(order.id)
    expect(data.shopOrders).toHaveLength(1)
    expect(data.shopOrders[0]?.id).toBe(so.id)
    expect(data.reviews).toHaveLength(1)
    expect(data.reviews[0]?.rating).toBe(5)
  })

  it('includes invoices as buyer and seller with third-party PII redacted', async () => {
    const owner = await createUser({ role: 'creator', email: 'owner@example.com' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(platformOrderRecord, s)
    const invoice = await createInvoice(so, {
      billingDetails: {
        from: {
          name: 'Seller Business',
          email: 'seller@example.com',
          address: { street: 'Secret St' },
        },
        to: { name: 'Buyer Name', email: 'buyer@example.com', address: { street: 'Buyer St' } },
      },
    })

    const buyerExport = await exportUserData(buyer.id)
    expect(buyerExport.invoices.asBuyer).toHaveLength(1)
    expect(buyerExport.invoices.asBuyer[0]?.invoiceNumber).toBe(invoice.invoiceNumber)
    expect(buyerExport.invoices.asBuyer[0]?.billingDetails).toEqual({
      from: { name: 'Seller Business' },
      to: { name: 'Buyer Name', email: 'buyer@example.com', address: { street: 'Buyer St' } },
    })
    expect(buyerExport.invoices.asSeller).toHaveLength(0)

    const sellerExport = await exportUserData(owner.id)
    expect(sellerExport.invoices.asSeller).toHaveLength(1)
    expect(sellerExport.invoices.asSeller[0]?.billingDetails).toEqual({
      from: {
        name: 'Seller Business',
        email: 'seller@example.com',
        address: { street: 'Secret St' },
      },
      to: { name: 'Buyer Name' },
    })
    expect(sellerExport.invoices.asBuyer).toHaveLength(0)
  })

  it('includes owner messages and dispute messages', async () => {
    const owner = await createUser({ role: 'creator' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(platformOrderRecord, s)
    const thread = await createOwnerMessageThread(s, {
      customerUserId: buyer.id,
      customerEmailHash: hashEmail(buyer.email),
      subject: 'Order question',
    })
    await createOwnerMessage(thread, { senderRole: 'buyer', body: 'Hello!' })
    const disputeRecord = await createDispute(so, buyer, {
      reason: 'missing',
      description: 'Missing item',
    })
    await createDisputeMessage(disputeRecord, buyer, { message: 'Where is my item?' })

    const data = await exportUserData(buyer.id)

    expect(data.messages.ownerThreads).toHaveLength(1)
    expect(data.messages.ownerThreads[0]?.subject).toBe('Order question')
    expect(data.messages.ownerThreads[0]?.messages).toHaveLength(1)
    expect(data.messages.ownerThreads[0]?.messages[0]?.body).toBe('Hello!')
    expect(data.messages.disputeMessages).toHaveLength(1)
    expect(data.messages.disputeMessages[0]?.message).toBe('Where is my item?')
  })

  it('includes audit logs and email preferences', async () => {
    const u = await createUser()
    await createAuditLog(u, {
      action: 'test.export',
      resourceType: 'user',
      resourceId: u.id,
      metadata: { key: 'value' },
    })
    await db.insert(userEmailPreference).values({
      userId: u.id,
      category: 'seller_updates',
      enabled: true,
    })

    const data = await exportUserData(u.id)

    expect(data.auditLogs).toHaveLength(1)
    expect(data.auditLogs[0]?.action).toBe('test.export')
    expect(data.auditLogs[0]?.metadata).toEqual({ key: 'value' })
    expect(data.emailPreferences).toHaveLength(1)
    expect(data.emailPreferences[0]?.category).toBe('seller_updates')
    expect(data.emailPreferences[0]?.enabled).toBe(true)
  })

  it('includes customer notes and tags by email hash', async () => {
    const owner = await createUser({ role: 'creator' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    await createCustomerNote(s, owner, {
      customerEmailHash: hashEmail(buyer.email),
      content: 'VIP customer',
    })
    await createCustomerTag(s, { customerEmailHash: hashEmail(buyer.email), tag: 'vip' })

    const data = await exportUserData(buyer.id)

    expect(data.customerNotes).toHaveLength(1)
    expect(data.customerNotes[0]?.content).toBe('VIP customer')
    expect(data.customerTags).toHaveLength(1)
    expect(data.customerTags[0]?.tag).toBe('vip')
  })

  it("does not include another user's PII", async () => {
    const u = await createUser({ email: 'user@example.com' })
    const other = await createUser({ email: 'other@example.com' })
    const s = await seedShop(other.id)
    const platformOrderRecord = await createPlatformOrder(other.id)
    const so = await createShopOrder(platformOrderRecord, s)
    await createInvoice(so, {
      billingDetails: {
        from: { name: 'Other Shop', email: 'other-shop@example.com' },
        to: { name: 'Other Buyer', email: 'other@example.com' },
      },
    })
    await createOwnerMessageThread(s, {
      customerUserId: other.id,
      customerEmailHash: hashEmail(other.email),
    })

    const data = await exportUserData(u.id)

    expect(data.invoices.asBuyer).toHaveLength(0)
    expect(data.invoices.asSeller).toHaveLength(0)
    expect(data.messages.ownerThreads).toHaveLength(0)
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

  it('redacts platform order addresses and stores them encrypted', async () => {
    const u = await createUser()
    const order = await createPlatformOrder(u.id)

    await deleteUserAccount(u.id)

    const updated = await db.query.platformOrder.findFirst({
      where: eq(platformOrder.id, order.id),
    })
    expect(typeof updated?.shippingAddress).toBe('string')
    expect(typeof updated?.billingAddress).toBe('string')
    expect(decryptJsonb(updated?.shippingAddress)).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
    expect(decryptJsonb(updated?.billingAddress)).toEqual(decryptJsonb(updated?.shippingAddress))
  })

  it('redacts invoice billing details for owned shops and stores them encrypted', async () => {
    const owner = await createUser({ role: 'creator' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(platformOrderRecord, s)
    const invoice = await createInvoice(so)

    await deleteUserAccount(owner.id)

    const updated = await db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) })
    expect(typeof updated?.billingDetails).toBe('string')
    expect(decryptJsonb(updated?.billingDetails)).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
  })

  it('redacts invoice billing details for buyer invoices and stores them encrypted', async () => {
    const owner = await createUser({ role: 'creator', email: 'owner@example.com' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(platformOrderRecord, s)
    const invoice = await createInvoice(so, {
      billingDetails: {
        from: { name: 'Test Shop', email: 'shop@example.com' },
        to: { name: 'Buyer Name', email: 'buyer@example.com' },
      },
    })

    await deleteUserAccount(buyer.id)

    const updated = await db.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) })
    expect(typeof updated?.billingDetails).toBe('string')
    expect(decryptJsonb(updated?.billingDetails)).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
  })

  it('redacts payout reconciliation log payloads for owned shops', async () => {
    const owner = await createUser({ role: 'creator' })
    const buyer = await createUser({ email: 'buyer@example.com' })
    const s = await seedShop(owner.id)
    const platformOrderRecord = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(platformOrderRecord, s)
    const log = await seedPayoutLog(s, so, {
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

  it('redacts shop business and shipping addresses and stores them encrypted', async () => {
    const u = await createUser({ role: 'creator' })
    const s = await seedShop(u.id)

    await deleteUserAccount(u.id)

    const updated = await db.query.shop.findFirst({ where: eq(shop.id, s.id) })
    expect(typeof updated?.businessAddress).toBe('string')
    expect(typeof updated?.shippingOrigin).toBe('string')
    expect(decryptJsonb(updated?.businessAddress)).toEqual({
      name: 'Deleted User',
      street: '[redacted]',
      city: '[redacted]',
      postalCode: '[redacted]',
      country: 'XX',
    })
    expect(decryptJsonb(updated?.shippingOrigin)).toEqual(decryptJsonb(updated?.businessAddress))
  })

  it('sets audit log actor name to Deleted User and nulls actor id', async () => {
    const u = await createUser()
    await createAuditLog(u, {
      actorName: u.name,
      action: 'shop.suspend',
      resourceType: 'shop',
      resourceId: 'shop-1',
      metadata: {},
    })

    await deleteUserAccount(u.id)

    const rows = await db.select().from(auditLog).where(eq(auditLog.actorName, 'Deleted User'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorName).toBe('Deleted User')
    expect(rows[0]?.actorId).toBeNull()
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

  it('clears the unsubscribe token on deletion', async () => {
    const u = await createUser()

    await deleteUserAccount(u.id)

    const updated = await db.query.user.findFirst({ where: eq(user.id, u.id) })
    expect(updated?.unsubscribeToken).toBeNull()
  })

  it('deletes user email preferences on deletion', async () => {
    const u = await createUser()
    await db.insert(userEmailPreference).values({
      userId: u.id,
      category: 'seller_updates',
      enabled: true,
    })

    await deleteUserAccount(u.id)

    const preferences = await db
      .select()
      .from(userEmailPreference)
      .where(eq(userEmailPreference.userId, u.id))
    expect(preferences).toHaveLength(0)
  })
})
