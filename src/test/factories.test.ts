import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, review, shop, shopOrder, user } from '#/db/schema'
import { clearTestTables } from './cleanup'
import {
  createCategory,
  createDispute,
  createNotification,
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createReview,
  createShop,
  createShopOrder,
  createUser,
} from './factories'
import { createPaidOrder } from './scenarios'

describe('test factories', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  describe('createUser', () => {
    it('creates a user with defaults', async () => {
      const u = await createUser()
      expect(u.name).toBe('Test User')
      expect(u.emailVerified).toBe(true)
      expect(u.role).toBe('customer')
    })

    it('applies overrides', async () => {
      const u = await createUser({ name: 'Alice', role: 'admin' })
      expect(u.name).toBe('Alice')
      expect(u.role).toBe('admin')
    })

    it('creates unique emails across calls', async () => {
      const a = await createUser()
      const b = await createUser()
      expect(a.email).not.toBe(b.email)
    })
  })

  describe('createShop', () => {
    it('creates a shop owned by the provided user', async () => {
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner)
      expect(s.ownerId).toBe(owner.id)
      expect(s.status).toBe('active')
      expect(s.currency).toBe('EUR')
    })

    it('accepts an owner id string', async () => {
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner.id)
      expect(s.ownerId).toBe(owner.id)
    })

    it('applies overrides', async () => {
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner, { status: 'draft' })
      expect(s.status).toBe('draft')
    })
  })

  describe('createProduct', () => {
    it('creates a product in the provided shop', async () => {
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner)
      const p = await createProduct(s)
      expect(p.shopId).toBe(s.id)
      expect(p.isActive).toBe(true)
    })

    it('accepts a shop id string', async () => {
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner)
      const p = await createProduct(s.id)
      expect(p.shopId).toBe(s.id)
    })
  })

  describe('createCategory', () => {
    it('creates a category with a unique slug', async () => {
      const a = await createCategory({ name: 'Pottery' })
      const b = await createCategory({ name: 'Woodwork' })
      expect(a.slug).not.toBe(b.slug)
    })
  })

  describe('order factories', () => {
    it('creates a platform order and a shop order', async () => {
      const buyer = await createUser()
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner)
      const po = await createPlatformOrder(buyer)
      const so = await createShopOrder(po, s)
      expect(po.userId).toBe(buyer.id)
      expect(so.platformOrderId).toBe(po.id)
      expect(so.shopId).toBe(s.id)
    })

    it('creates an order item with computed total', async () => {
      const owner = await createUser({ role: 'creator' })
      const s = await createShop(owner)
      const p = await createProduct(s, { priceCents: 1200 })
      const po = await createPlatformOrder(await createUser())
      const so = await createShopOrder(po, s)
      const item = await createOrderItem(so, p, { quantity: 3 })
      expect(item.totalCents).toBe(3600)
      expect(item.productName).toBe(p.name)
    })
  })

  describe('engagement factories', () => {
    it('creates a review', async () => {
      const { buyer, product, shopOrder } = await createPaidOrder()
      const r = await createReview(shopOrder, product, buyer, { rating: 4 })
      expect(r.rating).toBe(4)
      expect(r.buyerUserId).toBe(buyer.id)
      expect(r.productId).toBe(product.id)
    })

    it('creates a dispute', async () => {
      const { buyer, shopOrder } = await createPaidOrder()
      const d = await createDispute(shopOrder, buyer)
      expect(d.status).toBe('open')
      expect(d.buyerUserId).toBe(buyer.id)
    })

    it('creates a notification', async () => {
      const u = await createUser()
      const n = await createNotification(u, { type: 'order_placed' })
      expect(n.userId).toBe(u.id)
      expect(n.type).toBe('order_placed')
    })
  })

  describe('scenarios', () => {
    it('createPaidOrder builds a consistent order graph', async () => {
      const result = await createPaidOrder()
      expect(result.platformOrder.userId).toBe(result.buyer.id)
      expect(result.shopOrder.shopId).toBe(result.shop.id)
      expect(result.orderItem.shopOrderId).toBe(result.shopOrder.id)
      expect(result.orderItem.productId).toBe(result.product.id)
    })
  })

  describe('clearTestTables', () => {
    it('removes all seeded data', async () => {
      await createPaidOrder()
      await createReviewScenario()
      await clearTestTables()

      const users = await db.select().from(user)
      const shops = await db.select().from(shop)
      const products = await db.select().from(product)
      const platformOrders = await db.select().from(platformOrder)
      const shopOrders = await db.select().from(shopOrder)
      const orderItems = await db.select().from(orderItem)
      const reviews = await db.select().from(review)

      expect(users).toHaveLength(0)
      expect(shops).toHaveLength(0)
      expect(products).toHaveLength(0)
      expect(platformOrders).toHaveLength(0)
      expect(shopOrders).toHaveLength(0)
      expect(orderItems).toHaveLength(0)
      expect(reviews).toHaveLength(0)
    })
  })
})

async function createReviewScenario() {
  const { buyer, product, shopOrder } = await createPaidOrder()
  await createReview(shopOrder, product, buyer)
}
