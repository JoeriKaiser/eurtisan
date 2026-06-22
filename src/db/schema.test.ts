import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  inventoryReservation,
  orderItem,
  platformOrder,
  productOption,
  productOptionValue,
  productVariant,
  session,
  shopOrder,
} from '#/db/schema'
import {
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { clearTestTables } from '#/test/cleanup'

beforeEach(async () => {
  await clearTestTables()
})

describe('database constraints', () => {
  describe('session.tokenHash', () => {
    it('rejects a session without tokenHash', async () => {
      const u = await createUser()
      await expect(
        (async () => {
          await db
            .insert(session)
            // @ts-expect-error — intentional schema violation to test DB constraint.
            .values({
              id: 'session-missing-hash',
              userId: u.id,
              expiresAt: new Date(Date.now() + 60_000),
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })

  describe('productVariant', () => {
    it('rejects a negative stock count', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s)
      await expect(
        (async () => {
          await db
            .insert(productVariant)
            .values({
              id: 'pv-001-pv-negative-stock',
              productId: p.id,
              name: 'Bad stock',
              priceAdjustmentCents: 1000,
              stockCount: -1,
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })

    it('allows duplicate NULL skus but not duplicate non-null skus', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s)
      const sku = `SKU-${Date.now()}`
      await db.insert(productVariant).values({
        id: 'pv-002-pv-null-sku-a',
        productId: p.id,
        name: 'No SKU A',
        priceAdjustmentCents: 1000,
        stockCount: 1,
      })
      await db.insert(productVariant).values({
        id: 'pv-003-pv-null-sku-b',
        productId: p.id,
        name: 'No SKU B',
        priceAdjustmentCents: 1000,
        stockCount: 1,
      })
      await db.insert(productVariant).values({
        id: 'pv-004-pv-sku-1',
        productId: p.id,
        name: 'SKU 1',
        sku,
        priceAdjustmentCents: 1000,
        stockCount: 1,
      })
      await expect(
        (async () => {
          await db
            .insert(productVariant)
            .values({
              id: 'pv-005-pv-sku-2',
              productId: p.id,
              name: 'SKU 2',
              sku,
              priceAdjustmentCents: 1000,
              stockCount: 1,
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })

    it('rejects duplicate variant names within the same product', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s)
      await db.insert(productVariant).values({
        id: 'pv-006-pv-same-name-1',
        productId: p.id,
        name: 'Same Name',
        priceAdjustmentCents: 1000,
        stockCount: 1,
      })
      await expect(
        (async () => {
          await db
            .insert(productVariant)
            .values({
              id: 'pv-007-pv-same-name-2',
              productId: p.id,
              name: 'Same Name',
              priceAdjustmentCents: 2000,
              stockCount: 1,
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })

  describe('productOptionValue', () => {
    it('rejects duplicate values within the same option', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s)
      const [option] = await db
        .insert(productOption)
        .values({ id: 'pv-008-po-size', productId: p.id, name: 'Size' })
        .returning()
      await db
        .insert(productOptionValue)
        .values({ id: 'pv-009-pov-m', optionId: option.id, value: 'M' })
      await expect(
        (async () => {
          await db
            .insert(productOptionValue)
            .values({ id: 'pv-010-pov-m-2', optionId: option.id, value: 'M' })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })

  describe('cartItem', () => {
    it('rejects non-positive quantity', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s)
      const u = await createUser()
      const { createCart, createCartItem } = await import('#/test/factories')
      const c = await createCart(u)
      await expect(createCartItem(c.id, p.id, { quantity: 0 })).rejects.toThrow()
    })
  })

  describe('inventoryReservation', () => {
    it('rejects a reservation with both platform order and cart', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s, { stockCount: 10 })
      const buyer = await createUser()
      const po = await createPlatformOrder(buyer.id)
      const { createCart } = await import('#/test/factories')
      const c = await createCart(buyer)
      await expect(
        (async () => {
          await db
            .insert(inventoryReservation)
            .values({
              productId: p.id,
              platformOrderId: po.id,
              cartId: c.id,
              quantity: 1,
              expiresAt: new Date(Date.now() + 60_000),
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })

    it('rejects a reservation with neither platform order nor cart', async () => {
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s, { stockCount: 10 })
      await expect(
        (async () => {
          await db
            .insert(inventoryReservation)
            .values({
              productId: p.id,
              quantity: 1,
              expiresAt: new Date(Date.now() + 60_000),
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })

  describe('platformOrder refundedCents', () => {
    it('rejects refundedCents greater than totalCents', async () => {
      const buyer = await createUser()
      await expect(
        (async () => {
          await db
            .insert(platformOrder)
            .values({
              userId: buyer.id,
              totalCents: 1000,
              refundedCents: 1001,
              status: 'paid',
              shippingAddress: { name: 'Buyer', country: 'FR' },
              billingAddress: { name: 'Buyer', country: 'FR' },
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })

  describe('shopOrder refundedCents', () => {
    it('rejects refundedCents greater than subtotal + shipping', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const s = await createShop(owner)
      const po = await createPlatformOrder(buyer.id)
      await expect(
        (async () => {
          await db
            .insert(shopOrder)
            .values({
              platformOrderId: po.id,
              shopId: s.id,
              status: 'paid',
              subtotalCents: 1000,
              shippingCostCents: 100,
              vatAmountCents: 0,
              shippingVatAmountCents: 0,
              refundedCents: 1101,
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })

  describe('orderItem', () => {
    it('rejects non-positive quantity', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const s = await createShop(owner)
      const p = await createProduct(s)
      const po = await createPlatformOrder(buyer.id)
      const so = await createShopOrder(po, s)
      await expect(
        (async () => {
          await db
            .insert(orderItem)
            .values({
              shopOrderId: so.id,
              productId: p.id,
              productName: p.name,
              unitPriceCents: 100,
              quantity: 0,
              vatRateBasisPoints: 0,
              vatAmountCents: 0,
              totalCents: 0,
            })
            .returning()
        })(),
      ).rejects.toThrow()
    })
  })
})
