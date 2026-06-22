import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { financialTotalAudit, orderItem, platformOrder, shopOrder } from '#/db/schema'
import {
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import {
  recalcOrderItemTotal,
  recalcPlatformOrderTotal,
  recalcPlatformOrderTree,
  recalcShopOrderSubtotal,
  reconcileFinancialTotals,
  recordFinancialDiscrepancy,
} from './financial-totals.server'

describe('financial-totals.server', () => {
  beforeEach(async () => {
    await db.delete(financialTotalAudit)
    await db.delete(orderItem)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
  })

  describe('recalcOrderItemTotal', () => {
    it('computes total and VAT from unit price, quantity and VAT rate', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const shop = await createShop(owner)
      const product = await createProduct(shop)
      const po = await createPlatformOrder(buyer.id)
      const so = await createShopOrder(po, shop)
      const [item] = await db
        .insert(orderItem)
        .values({
          shopOrderId: so.id,
          productId: product.id,
          productName: product.name,
          unitPriceCents: 1000,
          quantity: 3,
          vatRateBasisPoints: 2100,
          vatAmountCents: 0,
          totalCents: 0,
        })
        .returning()

      const result = await db.transaction(async (tx) => recalcOrderItemTotal(tx, item.id))

      expect(result.totalCents).toBe(3000)
      expect(result.vatAmountCents).toBe(630)

      const updated = await db.select().from(orderItem).where(eq(orderItem.id, item.id))
      expect(updated[0]?.totalCents).toBe(3000)
      expect(updated[0]?.vatAmountCents).toBe(630)
    })
  })

  describe('recalcShopOrderSubtotal', () => {
    it('sums order item totals into the shop order subtotal', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const shop = await createShop(owner)
      const productA = await createProduct(shop, { name: 'Product A' })
      const productB = await createProduct(shop, { name: 'Product B' })
      const po = await createPlatformOrder(buyer.id)
      const so = await createShopOrder(po, shop, { subtotalCents: 0 })
      await db.insert(orderItem).values([
        {
          shopOrderId: so.id,
          productId: productA.id,
          productName: productA.name,
          unitPriceCents: 500,
          quantity: 1,
          vatRateBasisPoints: 0,
          vatAmountCents: 0,
          totalCents: 500,
        },
        {
          shopOrderId: so.id,
          productId: productB.id,
          productName: productB.name,
          unitPriceCents: 750,
          quantity: 2,
          vatRateBasisPoints: 0,
          vatAmountCents: 0,
          totalCents: 1500,
        },
      ])

      const result = await db.transaction(async (tx) => recalcShopOrderSubtotal(tx, so.id))

      expect(result.subtotalCents).toBe(2000)
      expect(result.vatAmountCents).toBe(0)
      const updated = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
      expect(updated[0]?.subtotalCents).toBe(2000)
    })
  })

  describe('recalcPlatformOrderTotal', () => {
    it('sums shop order totals into the platform order total', async () => {
      const buyer = await createUser()
      const po = await createPlatformOrder(buyer.id, { totalCents: 0 })
      const owner = await createUser()
      const shop = await createShop(owner)
      await db.insert(shopOrder).values({
        platformOrderId: po.id,
        shopId: shop.id,
        status: 'paid',
        subtotalCents: 3000,
        shippingCostCents: 500,
        vatAmountCents: 630,
        shippingVatAmountCents: 105,
      })

      const result = await db.transaction(async (tx) => recalcPlatformOrderTotal(tx, po.id))

      expect(result).toBe(4235)
      const updated = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
      expect(updated[0]?.totalCents).toBe(4235)
    })
  })

  describe('recalcPlatformOrderTree', () => {
    it('recalculates all order items, shop order subtotals and platform order total', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const shop = await createShop(owner)
      const product = await createProduct(shop, { priceCents: 1000 })
      const po = await createPlatformOrder(buyer.id, { totalCents: 0 })
      const so = await createShopOrder(po, shop, {
        subtotalCents: 0,
        shippingCostCents: 0,
        vatAmountCents: 0,
        shippingVatAmountCents: 0,
      })
      const [item] = await db
        .insert(orderItem)
        .values({
          shopOrderId: so.id,
          productId: product.id,
          productName: product.name,
          unitPriceCents: 1000,
          quantity: 2,
          vatRateBasisPoints: 2000,
          vatAmountCents: 0,
          totalCents: 0,
        })
        .returning()

      await db.transaction(async (tx) => recalcPlatformOrderTree(tx, po.id))

      const items = await db.select().from(orderItem).where(eq(orderItem.id, item.id))
      expect(items[0]?.totalCents).toBe(2000)
      expect(items[0]?.vatAmountCents).toBe(400)

      const orders = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
      expect(orders[0]?.subtotalCents).toBe(2000)

      const platformOrders = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, po.id))
      expect(platformOrders[0]?.totalCents).toBe(2400)
    })
  })

  describe('reconcileFinancialTotals', () => {
    it('records a discrepancy when stored total does not match computed total', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const shop = await createShop(owner)
      const po = await createPlatformOrder(buyer.id, { totalCents: 9999 })
      await db.insert(shopOrder).values({
        platformOrderId: po.id,
        shopId: shop.id,
        status: 'paid',
        subtotalCents: 1000,
        shippingCostCents: 0,
        vatAmountCents: 0,
        shippingVatAmountCents: 0,
      })

      const count = await db.transaction(async (tx) => reconcileFinancialTotals(tx))

      expect(count).toBeGreaterThanOrEqual(1)
      const audits = await db.select().from(financialTotalAudit)
      const poAudit = audits.find((a) => a.entityType === 'platform_order' && a.entityId === po.id)
      expect(poAudit).toBeDefined()
      expect(poAudit?.storedCents).toBe(9999)
      expect(poAudit?.computedCents).toBe(1000)
    })
  })

  describe('recordFinancialDiscrepancy', () => {
    it('stores a discrepancy row', async () => {
      await db.transaction(async (tx) =>
        recordFinancialDiscrepancy(tx, {
          entityType: 'shop_order',
          entityId: 'so-test',
          fieldName: 'subtotalCents',
          storedCents: 100,
          computedCents: 200,
        }),
      )

      const rows = await db.select().from(financialTotalAudit)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.diffCents).toBe(100)
    })
  })
})
