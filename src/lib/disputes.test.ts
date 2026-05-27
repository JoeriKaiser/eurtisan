import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import {
  dispute,
  disputeMessage,
  notification,
  orderItem,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import { molliePaymentProvider } from '#/integrations/mollie'

import {
  addDisputeMessageQuery,
  getDisputeDetailQuery,
  listOpenDisputesQuery,
  openDisputeQuery,
  resolveDisputeQuery,
} from './disputes.server'

beforeEach(async () => {
  await db.delete(notification)
  await db.delete(disputeMessage)
  await db.delete(dispute)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

afterAll(async () => {
  await db.delete(notification)
  await db.delete(disputeMessage)
  await db.delete(dispute)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedDeliveredOrder(overrides?: {
  userId?: string
  deliveredAt?: Date
  subtotalCents?: number
  shippingCostCents?: number
  molliePaymentId?: string
}) {
  const u = overrides?.userId ?? 'user-1'
  const [order] = await db
    .insert(platformOrder)
    .values({
      userId: u,
      shippingAddress: {
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      billingAddress: {
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      totalCents: 2500,
      molliePaymentId: overrides?.molliePaymentId ?? null,
    })
    .returning()

  const [so] = await db
    .insert(shopOrder)
    .values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: overrides?.shippingCostCents ?? 500,
      subtotalCents: overrides?.subtotalCents ?? 2000,
      status: 'delivered',
      deliveredAt: overrides?.deliveredAt ?? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    })
    .returning()

  return { order, shopOrder: so }
}

/* -------------------------------------------------------------------------- */
/*                                openDisputeQuery                            */
/* -------------------------------------------------------------------------- */

describe('openDisputeQuery', () => {
  it('throws 404 for nonexistent shop order', async () => {
    try {
      await openDisputeQuery(
        {
          shopOrderId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'Item not as described',
          description: 'The color is wrong',
        },
        'user-1',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 400 when order is not delivered', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'shipped',
      })
      .returning()

    try {
      await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Missing item', description: 'Item was not in package' },
        'user-1',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 403 when order belongs to another user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await seedUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.com',
    })

    const { shopOrder: so } = await seedDeliveredOrder({ userId: otherUser.id })

    try {
      await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Wrong item', description: 'I got a vase instead of a bowl' },
        'user-1',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('throws 403 when past 30 days since delivery', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder({
      deliveredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    })

    try {
      await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Late dispute', description: 'This is too late' },
        'user-1',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('throws 400 when deliveredAt is missing', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'delivered',
        deliveredAt: null,
      })
      .returning()

    try {
      await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Missing date', description: 'No delivery date' },
        'user-1',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 409 when dispute already exists', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()

    await openDisputeQuery(
      { shopOrderId: so.id, reason: 'First', description: 'First dispute' },
      'user-1',
    )

    try {
      await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Second', description: 'Second dispute' },
        'user-1',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('creates dispute and transitions order to disputed', async () => {
    await seedUser()
    await seedShop()

    const { order, shopOrder: so } = await seedDeliveredOrder()

    const result = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Defective', description: 'Item arrived broken' },
      'user-1',
    )

    expect(result.id).toBeDefined()
    expect(result.shopOrderId).toBe(so.id)
    expect(result.buyerUserId).toBe('user-1')
    expect(result.reason).toBe('Defective')
    expect(result.description).toBe('Item arrived broken')
    expect(result.status).toBe('open')

    const [updatedOrder] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedOrder.status).toBe('disputed')

    const [updatedPlatform] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(updatedPlatform.status).toBe('disputed')
  })

  it('allows dispute exactly on day 30', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder({
      deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 60 * 1000),
    })

    const result = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Day 30', description: 'Just in time' },
      'user-1',
    )

    expect(result.status).toBe('open')
  })
})

/* -------------------------------------------------------------------------- */
/*                             addDisputeMessageQuery                         */
/* -------------------------------------------------------------------------- */

describe('addDisputeMessageQuery', () => {
  it('throws 404 for nonexistent dispute', async () => {
    try {
      await addDisputeMessageQuery(
        '550e8400-e29b-41d4-a716-446655440000',
        'Hello',
        'user-1',
        'customer',
      )
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 403 for unauthorized user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await seedUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.com',
    })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    try {
      await addDisputeMessageQuery(d.id, 'Hello', otherUser.id, 'customer')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('allows buyer to post a message', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await addDisputeMessageQuery(d.id, 'My message', 'user-1', 'customer')
    expect(result.disputeId).toBe(d.id)
    expect(result.senderUserId).toBe('user-1')
    expect(result.message).toBe('My message')
  })

  it('allows shop owner to post a message', async () => {
    await seedUser()
    await seedShop()
    const buyer = await seedUser({
      id: 'user-2',
      name: 'Buyer',
      email: 'buyer@example.com',
    })

    const { shopOrder: so } = await seedDeliveredOrder({ userId: buyer.id })
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      buyer.id,
    )

    const result = await addDisputeMessageQuery(d.id, 'Owner reply', 'user-1', 'creator')
    expect(result.message).toBe('Owner reply')
  })

  it('allows admin to post a message', async () => {
    await seedUser()
    await seedShop()
    const admin = await seedUser({
      id: 'user-3',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await addDisputeMessageQuery(d.id, 'Admin note', admin.id, 'admin')
    expect(result.message).toBe('Admin note')
  })

  it('sanitizes HTML in messages', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await addDisputeMessageQuery(
      d.id,
      '<script>alert("xss")</script>',
      'user-1',
      'customer',
    )
    expect(result.message).toBe('')
  })
})

/* -------------------------------------------------------------------------- */
/*                             listOpenDisputesQuery                          */
/* -------------------------------------------------------------------------- */

const DEFAULT_PAGE = { page: 1, pageSize: 20 }

describe('listOpenDisputesQuery', () => {
  it('returns empty disputes array when no open disputes', async () => {
    const result = await listOpenDisputesQuery(DEFAULT_PAGE)
    expect(result.disputes).toEqual([])
    expect(result.total).toBe(0)
  })

  it('returns open disputes with participant names and order info', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Damaged', description: 'Box was crushed' },
      'user-1',
    )

    const result = await listOpenDisputesQuery(DEFAULT_PAGE)
    expect(result.disputes).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.disputes[0].id).toBe(d.id)
    expect(result.disputes[0].buyerName).toBe('Test')
    expect(result.disputes[0].creatorName).toBe('Test')
    expect(result.disputes[0].shopName).toBe('Test Shop')
    expect(result.disputes[0].reason).toBe('Damaged')
    expect(result.disputes[0].status).toBe('open')
    expect(result.disputes[0].orderTotalCents).toBe(2500)
  })

  it('does not include resolved disputes', async () => {
    await seedUser()
    await seedShop()
    await seedUser({
      id: 'user-3',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'close' })

    const result = await listOpenDisputesQuery(DEFAULT_PAGE)
    expect(result.disputes).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('orders by created_at ascending', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so1 } = await seedDeliveredOrder()
    const d1 = await openDisputeQuery(
      { shopOrderId: so1.id, reason: 'First', description: 'First dispute' },
      'user-1',
    )

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 50))

    const { shopOrder: so2 } = await seedDeliveredOrder()
    const d2 = await openDisputeQuery(
      { shopOrderId: so2.id, reason: 'Second', description: 'Second dispute' },
      'user-1',
    )

    const result = await listOpenDisputesQuery(DEFAULT_PAGE)
    expect(result.disputes).toHaveLength(2)
    expect(result.disputes[0].id).toBe(d1.id)
    expect(result.disputes[1].id).toBe(d2.id)
  })

  it('supports pagination', async () => {
    await seedUser()
    await seedShop()

    // Create 3 disputes
    for (let i = 0; i < 3; i++) {
      const { shopOrder: so } = await seedDeliveredOrder()
      await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Issue', description: `Dispute ${i}` },
        'user-1',
      )
    }

    const page1 = await listOpenDisputesQuery({ page: 1, pageSize: 2 })
    expect(page1.disputes).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(2)

    const page2 = await listOpenDisputesQuery({ page: 2, pageSize: 2 })
    expect(page2.disputes).toHaveLength(1)
    expect(page2.total).toBe(3)
    expect(page2.page).toBe(2)
  })

  it('returns empty disputes for page beyond total', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Dispute' },
      'user-1',
    )

    const result = await listOpenDisputesQuery({ page: 10, pageSize: 20 })
    expect(result.disputes).toHaveLength(0)
    expect(result.total).toBe(1)
  })

  it('supports searching by query (buyer name, creator name, shop order id)', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Damaged', description: 'Box was crushed' },
      'user-1',
    )

    // Query matching buyer name
    const matchBuyer = await listOpenDisputesQuery({ ...DEFAULT_PAGE, query: 'Test' })
    expect(matchBuyer.disputes).toHaveLength(1)
    expect(matchBuyer.total).toBe(1)

    // Query matching creator/owner name
    const matchCreator = await listOpenDisputesQuery({ ...DEFAULT_PAGE, query: 'Test' })
    expect(matchCreator.disputes).toHaveLength(1)
    expect(matchCreator.total).toBe(1)

    // Query matching shopOrderId
    const matchOrderId = await listOpenDisputesQuery({ ...DEFAULT_PAGE, query: so.id })
    expect(matchOrderId.disputes).toHaveLength(1)
    expect(matchOrderId.total).toBe(1)

    // Query matching nothing
    const noMatch = await listOpenDisputesQuery({ ...DEFAULT_PAGE, query: 'Nonexistent' })
    expect(noMatch.disputes).toHaveLength(0)
    expect(noMatch.total).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                             getDisputeDetailQuery                          */
/* -------------------------------------------------------------------------- */

describe('getDisputeDetailQuery', () => {
  it('throws 404 for nonexistent dispute', async () => {
    try {
      await getDisputeDetailQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1', 'customer')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 403 for unauthorized user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await seedUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.com',
    })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    try {
      await getDisputeDetailQuery(d.id, otherUser.id, 'customer')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('returns detail for buyer', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    // Seed a product so the order item FK constraint is satisfied
    await db.insert(product).values({
      id: 'product-1',
      name: 'Test Product',
      slug: 'test-product',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'shop-1',
    })

    // Seed an order item to test items array
    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: 'product-1',
      productName: 'Test Product',
      unitPriceCents: 1000,
      quantity: 2,
      totalCents: 2000,
    })

    await addDisputeMessageQuery(d.id, 'Message 1', 'user-1', 'customer')

    const result = await getDisputeDetailQuery(d.id, 'user-1', 'customer')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(d.id)
    expect(result?.buyer.name).toBe('Test')
    expect(result?.buyer.email).toBe('test@example.com')
    expect(result?.shop.name).toBe('Test')
    expect(result?.shop.email).toBe('test@example.com')
    expect(result?.messages).toHaveLength(1)
    expect(result?.messages[0].message).toBe('Message 1')
    expect(result?.order.shopName).toBe('Test Shop')
    expect(result?.order.totalCents).toBe(2500)
    expect(result?.order.createdAt).toBeDefined()
    expect(result?.order.items).toHaveLength(1)
    expect(result?.order.items[0].productName).toBe('Test Product')
    expect(result?.order.items[0].unitPriceCents).toBe(1000)
    expect(result?.order.items[0].quantity).toBe(2)
    expect(result?.order.items[0].totalCents).toBe(2000)
  })

  it('returns detail for shop owner', async () => {
    await seedUser()
    await seedShop()
    const buyer = await seedUser({
      id: 'user-2',
      name: 'Buyer',
      email: 'buyer@example.com',
    })

    const { shopOrder: so } = await seedDeliveredOrder({ userId: buyer.id })
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      buyer.id,
    )

    const result = await getDisputeDetailQuery(d.id, 'user-1', 'creator')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(d.id)
  })

  it('returns detail for admin', async () => {
    await seedUser()
    await seedShop()
    const admin = await seedUser({
      id: 'user-3',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await getDisputeDetailQuery(d.id, admin.id, 'admin')
    expect(result).not.toBeNull()
    expect(result?.id).toBe(d.id)
  })
})

/* -------------------------------------------------------------------------- */
/*                             resolveDisputeQuery                            */
/* -------------------------------------------------------------------------- */

describe('resolveDisputeQuery', () => {
  it('throws 404 for nonexistent dispute', async () => {
    try {
      await resolveDisputeQuery('550e8400-e29b-41d4-a716-446655440000', { resolution: 'close' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 409 when dispute is not open', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'close' })

    try {
      await resolveDisputeQuery(d.id, { resolution: 'close' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('throws 400 when partial refund amount exceeds order total', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder({
      subtotalCents: 1000,
      shippingCostCents: 100,
    })
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    try {
      await resolveDisputeQuery(d.id, { resolution: 'partial_refund', refundCents: 2000 })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 when partial refund amount is 0', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    try {
      await resolveDisputeQuery(d.id, { resolution: 'partial_refund', refundCents: 0 })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 when partial refund amount is missing', async () => {
    await seedUser()
    await seedShop()

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    try {
      await resolveDisputeQuery(d.id, { resolution: 'partial_refund' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('resolves with close and transitions to completed', async () => {
    await seedUser()
    await seedShop()

    const { order, shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await resolveDisputeQuery(d.id, { resolution: 'close' })

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('close')
    expect(result.refundCents).toBeNull()

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('completed')

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, order.id))
    expect(updatedPo.status).toBe('completed')
  })

  it('resolves with full_refund and transitions to refunded', async () => {
    await seedUser()
    await seedShop()

    const { order, shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await resolveDisputeQuery(d.id, { resolution: 'full_refund' })

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('full_refund')
    expect(result.refundCents).toBe(2500)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, order.id))
    expect(updatedPo.status).toBe('refunded')
  })

  it('resolves with partial_refund and transitions to refunded', async () => {
    await seedUser()
    await seedShop()

    const { order, shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    const result = await resolveDisputeQuery(d.id, {
      resolution: 'partial_refund',
      refundCents: 1000,
    })

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('partial_refund')
    expect(result.refundCents).toBe(1000)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, order.id))
    expect(updatedPo.status).toBe('refunded')
  })

  it('sends dispute_resolved notification to buyer on close resolution', async () => {
    await seedUser()
    const seller = await seedUser({
      id: 'user-2',
      name: 'Seller',
      email: 'seller@example.com',
    })
    await seedShop({ ownerId: seller.id })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'close' })

    const { getNotificationsQuery } = await import('./notifications.server')
    const buyerNotifications = await getNotificationsQuery('user-1', 1, 10)
    const resolvedNotifications = buyerNotifications.notifications.filter(
      (n) => n.type === 'dispute_resolved',
    )
    expect(resolvedNotifications).toHaveLength(1)
    expect(resolvedNotifications[0].type).toBe('dispute_resolved')
    expect(resolvedNotifications[0].data).toMatchObject({
      disputeId: d.id,
      shopOrderId: so.id,
      resolution: 'close',
      refundCents: null,
    })
  })

  it('sends dispute_resolved notification to creator (shop owner) on close resolution', async () => {
    await seedUser()
    const seller = await seedUser({
      id: 'user-2',
      name: 'Seller',
      email: 'seller@example.com',
    })
    await seedShop({ ownerId: seller.id })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'close' })

    const { getNotificationsQuery } = await import('./notifications.server')
    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(1)
    expect(sellerNotifications.notifications[0].type).toBe('dispute_resolved')
    expect(sellerNotifications.notifications[0].data).toMatchObject({
      disputeId: d.id,
      shopOrderId: so.id,
      resolution: 'close',
      refundCents: null,
    })
  })

  it('sends dispute_resolved notification with refundCents on full_refund', async () => {
    await seedUser()
    const seller = await seedUser({
      id: 'user-2',
      name: 'Seller',
      email: 'seller@example.com',
    })
    await seedShop({ ownerId: seller.id })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'full_refund' })

    const { getNotificationsQuery } = await import('./notifications.server')
    const buyerNotifications = await getNotificationsQuery('user-1', 1, 10)
    const buyerResolved = buyerNotifications.notifications.filter(
      (n) => n.type === 'dispute_resolved',
    )
    expect(buyerResolved[0].data).toMatchObject({
      resolution: 'full_refund',
      refundCents: 2500,
    })

    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    const sellerResolved = sellerNotifications.notifications.filter(
      (n) => n.type === 'dispute_resolved',
    )
    expect(sellerResolved).toHaveLength(1)
    expect(sellerResolved[0].type).toBe('dispute_resolved')
  })

  it('sends dispute_resolved notification with refundCents on partial_refund', async () => {
    await seedUser()
    const seller = await seedUser({
      id: 'user-2',
      name: 'Seller',
      email: 'seller@example.com',
    })
    await seedShop({ ownerId: seller.id })

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'partial_refund', refundCents: 500 })

    const { getNotificationsQuery } = await import('./notifications.server')
    const buyerNotifications = await getNotificationsQuery('user-1', 1, 10)
    const buyerResolved = buyerNotifications.notifications.filter(
      (n) => n.type === 'dispute_resolved',
    )
    expect(buyerResolved[0].data).toMatchObject({
      resolution: 'partial_refund',
      refundCents: 500,
    })
  })

  it('calls refundPayment for full_refund resolution', async () => {
    await seedUser()
    await seedShop()

    const refundSpy = vi.spyOn(molliePaymentProvider, 'refundPayment').mockResolvedValue(undefined)

    const { shopOrder: so } = await seedDeliveredOrder({ molliePaymentId: 'tr_mock_000001' })
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'full_refund' })

    expect(refundSpy).toHaveBeenCalledTimes(1)
    expect(refundSpy).toHaveBeenCalledWith('tr_mock_000001', 2500)

    refundSpy.mockRestore()
  })

  it('calls refundPayment for partial_refund resolution', async () => {
    await seedUser()
    await seedShop()

    const refundSpy = vi.spyOn(molliePaymentProvider, 'refundPayment').mockResolvedValue(undefined)

    const { shopOrder: so } = await seedDeliveredOrder({ molliePaymentId: 'tr_mock_000001' })
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'partial_refund', refundCents: 1000 })

    expect(refundSpy).toHaveBeenCalledTimes(1)
    expect(refundSpy).toHaveBeenCalledWith('tr_mock_000001', 1000)

    refundSpy.mockRestore()
  })

  it('rolls back the database transaction and throws when refundPayment fails', async () => {
    await seedUser()
    await seedShop()

    const refundSpy = vi
      .spyOn(molliePaymentProvider, 'refundPayment')
      .mockRejectedValue(new Error('Mollie refund error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { order, shopOrder: so } = await seedDeliveredOrder({
        molliePaymentId: 'tr_mock_000001',
      })
      const d = await openDisputeQuery(
        { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
        'user-1',
      )

      await expect(resolveDisputeQuery(d.id, { resolution: 'full_refund' })).rejects.toBeInstanceOf(
        Response,
      )

      // Assert database did NOT update (rolled back)
      const [updatedDispute] = await db.select().from(dispute).where(eq(dispute.id, d.id))
      expect(updatedDispute.status).toBe('open')

      const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
      expect(updatedSo.status).toBe('disputed')

      const [updatedPo] = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
      expect(updatedPo.status).toBe('disputed')

      expect(refundSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mollie refund failed for payment tr_mock_000001'),
        expect.any(Error),
      )
    } finally {
      refundSpy.mockRestore()
      consoleSpy.mockRestore()
    }
  })

  it('does not call refundPayment for close resolution', async () => {
    await seedUser()
    await seedShop()

    const refundSpy = vi.spyOn(molliePaymentProvider, 'refundPayment').mockResolvedValue(undefined)

    const { shopOrder: so } = await seedDeliveredOrder({ molliePaymentId: 'tr_mock_000001' })
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'close' })

    expect(refundSpy).not.toHaveBeenCalled()

    refundSpy.mockRestore()
  })

  it('does not call refundPayment when molliePaymentId is null', async () => {
    await seedUser()
    await seedShop()

    const refundSpy = vi.spyOn(molliePaymentProvider, 'refundPayment').mockResolvedValue(undefined)

    const { shopOrder: so } = await seedDeliveredOrder()
    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      'user-1',
    )

    await resolveDisputeQuery(d.id, { resolution: 'full_refund' })

    expect(refundSpy).not.toHaveBeenCalled()

    refundSpy.mockRestore()
  })
})
