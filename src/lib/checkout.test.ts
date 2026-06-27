import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { decryptJsonb } from '#/lib/encryption.server'
import {
  cart,
  cartItem,
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  shop,
  shopOrder,
  type user,
} from '#/db/schema'
import { getShippingProvider, resetMockShippingCounter } from '#/integrations/shipping'
import { clearTestTables } from '#/test/cleanup'
import {
  createCart,
  createCartItem,
  createInventoryReservation,
  createPlatformOrder,
  createProduct,
  createShop,
  createUser,
} from '#/test/factories'
import {
  type CheckoutInput,
  createCheckoutWithProvider,
  getCheckoutSummaryQuery,
  retryPayment,
} from './checkout.server'
import type { PaymentProvider } from './payment-provider'

// Mock VIES so cross-border B2B reverse-charge tests do not depend on the
// live European Commission API (which is flaky and now fails closed).
vi.mock('#/lib/vat.server', async (importOriginal) => {
  const mod = await importOriginal<typeof import('#/lib/vat.server')>()
  return {
    ...mod,
    verifyVatIdVies: vi.fn().mockResolvedValue(true),
  }
})

// Run all tests in this file sequentially because they mutate the shared
// test database. Parallel execution causes race conditions between beforeEach
// cleanup and test seeding.
describe.sequential('checkout', () => {
  // ---------------------------------------------------------------------------
  // Test stub for the payment provider
  // ---------------------------------------------------------------------------

  let stubPaymentIdCounter = 0

  function createStubPaymentProvider(): PaymentProvider {
    const testPaymentId = `test_payment_${++stubPaymentIdCounter}`
    const testCheckoutUrl = `https://checkout.mollie.com/pay/${testPaymentId}`

    return {
      createPayment: async () => ({
        paymentId: testPaymentId,
        checkoutUrl: testCheckoutUrl,
      }),
      verifyWebhook: async () => false,
      getPaymentStatus: async () => 'paid',
      getPaymentAmount: async () => 1000,
      refundPayment: async () => undefined,
      cancelPayment: async () => undefined,
    }
  }

  beforeEach(async () => {
    resetMockShippingCounter()

    // Accept any pick-up point for tests that are not exercising the
    // service-point flow. This keeps the existing fixtures valid without
    // requiring every test to supply a pick-up point and matching rateId.
    vi.spyOn(getShippingProvider(), 'getServicePointMethods').mockResolvedValue([
      {
        rateId: '',
        carrier: 'sendcloud',
        serviceName: 'Sendcloud Standard',
        priceCents: 538,
        estimatedDays: { min: 2, max: 4 },
        supportsServicePoint: true,
      },
    ])

    await clearTestTables()
  })

  afterAll(async () => {
    await clearTestTables()
  })

  async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
    return createUser({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
      ...overrides,
    })
  }

  async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
    return createShop('user-1', {
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      status: 'active',
      ...overrides,
    })
  }

  async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
    return createProduct('shop-1', {
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 10,
      ...overrides,
    })
  }

  describe('getCheckoutSummaryQuery', () => {
    it('returns null for nonexistent cart', async () => {
      const result = await getCheckoutSummaryQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
      expect(result).toBeNull()
    })

    it('returns null when cart belongs to another user', async () => {
      await seedUser()
      await seedShop()
      const otherUser = await seedUser({ id: 'user-2', name: 'Other', email: 'other@example.com' })
      const c = await createCart(otherUser.id)

      const result = await getCheckoutSummaryQuery(c.id, 'user-1')
      expect(result).toBeNull()
    })

    it('returns summary grouped by shop with fallback shipping options when no address', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 2 })

      const result = await getCheckoutSummaryQuery(c.id, 'user-1')
      expect(result).not.toBeNull()
      expect(result?.cartId).toBe(c.id)
      expect(result?.shops).toHaveLength(1)
      expect(result?.shops[0].items).toHaveLength(1)
      // Without shipping address, returns fallback (manual) options
      expect(result?.shops[0].shippingOptions).toHaveLength(1)
      expect(result?.shops[0].shippingOptions[0].method).toBe('manual')
      expect(result?.shops[0].shippingOptions[0].fallback).toBe(true)
    })

    it('returns summary with live shipping rates when address is provided', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 2 })

      const result = await getCheckoutSummaryQuery(c.id, 'user-1', {
        name: 'Test User',
        street: '123 Main St',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      })
      expect(result).not.toBeNull()
      expect(result?.shops).toHaveLength(1)
      // With shipping address, returns carrier rates
      expect(result?.shops[0].shippingOptions.length).toBeGreaterThanOrEqual(1)
      const standardOption = result?.shops[0].shippingOptions.find((o) => o.method === 'standard')
      const expressOption = result?.shops[0].shippingOptions.find((o) => o.method === 'express')
      expect(standardOption).toBeDefined()
      expect(expressOption).toBeDefined()
      expect(standardOption?.carrier).toBe('sendcloud')
      expect(standardOption?.rateId).toBeDefined()
      expect(standardOption?.costCents).toBeGreaterThan(0)
      expect(expressOption?.costCents).toBeGreaterThan(standardOption?.costCents ?? 0)
    })

    async function seedCrossBorderShop() {
      await seedUser()
      await seedShop({
        isVatRegistered: true,
        shippingOrigin: {
          street: '1 Rue de Paris',
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      })
      const c = await createCart('user-1')
      const p = await seedProduct({ priceCents: 1000 })
      await createCartItem(c.id, p.id, { quantity: 1 })
      return { cart: c, product: p }
    }

    function withZeroRateShipping<T>(fn: () => Promise<T>): Promise<T> {
      const spy = vi.spyOn(getShippingProvider(), 'getRates').mockResolvedValue([
        {
          rateId: 'std',
          carrier: 'sendcloud',
          serviceName: 'Sendcloud Standard',
          priceCents: 0,
          estimatedDays: { min: 2, max: 4 },
        },
      ])
      return fn().finally(() => spy.mockRestore())
    }

    it('applies reverse charge for cross-border EU B2B transactions', async () => {
      const { cart } = await seedCrossBorderShop()

      const shopRecord = await db.select().from(shop).where(eq(shop.id, 'shop-1')).limit(1)
      expect(shopRecord[0]?.isVatRegistered).toBe(true)

      const result = await withZeroRateShipping(() =>
        getCheckoutSummaryQuery(cart.id, 'user-1', {
          name: 'Test User',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
          vatId: 'DE123456789',
        }),
      )

      expect(result).not.toBeNull()
      const shopGroup = result?.shops[0]
      expect(shopGroup?.vatEstimateCents).toBe(0) // reverse charge: buyer accounts for VAT locally
    })

    it('does not apply reverse charge for non-EU buyers like Switzerland', async () => {
      const { cart } = await seedCrossBorderShop()

      const result = await withZeroRateShipping(() =>
        getCheckoutSummaryQuery(cart.id, 'user-1', {
          name: 'Test User',
          street: '123 Main St',
          city: 'Zurich',
          postalCode: '8001',
          country: 'CH',
          vatId: 'CHE123456789', // invalid format for EU, but CH is not in member-state list
        }),
      )

      expect(result).not.toBeNull()
      const shopGroup = result?.shops[0]
      expect(shopGroup?.vatEstimateCents).toBe(0) // export outside EU
    })

    it('treats Greece as GR for cross-border B2B eligibility', async () => {
      const { cart } = await seedCrossBorderShop()

      const result = await withZeroRateShipping(() =>
        getCheckoutSummaryQuery(cart.id, 'user-1', {
          name: 'Test User',
          street: '123 Main St',
          city: 'Athens',
          postalCode: '10552',
          country: 'GR',
          vatId: 'EL123456789',
        }),
      )

      expect(result).not.toBeNull()
      const shopGroup = result?.shops[0]
      expect(shopGroup?.vatEstimateCents).toBe(0) // reverse charge: buyer accounts for VAT locally
    })

    it('uses the shop shipping origin instead of the hardcoded platform origin', async () => {
      await seedUser()
      await seedShop({
        shippingOrigin: {
          street: '456 Warehouse Ave',
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
      })
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const spy = vi.spyOn(getShippingProvider(), 'getRates').mockResolvedValue([
        {
          rateId: 'sendcloud_std_test',
          carrier: 'sendcloud',
          serviceName: 'Sendcloud Standard',
          priceCents: 538,
          estimatedDays: { min: 2, max: 4 },
        },
        {
          rateId: 'sendcloud_xpr_test',
          carrier: 'sendcloud',
          serviceName: 'Sendcloud Express',
          priceCents: 861,
          estimatedDays: { min: 1, max: 3 },
        },
      ])

      const result = await getCheckoutSummaryQuery(c.id, 'user-1', {
        name: 'Test User',
        street: '123 Main St',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      })

      expect(result).not.toBeNull()
      expect(spy).toHaveBeenCalledTimes(1)
      const calledOrigin = spy.mock.calls[0][0]
      expect(calledOrigin.country).toBe('FR')
      expect(calledOrigin.city).toBe('Paris')

      spy.mockRestore()
    })

    it('calculates subtotals and grand total correctly', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p1 = await seedProduct({ id: 'prod-1', priceCents: 1000 })
      const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', priceCents: 2000 })

      await createCartItem(c.id, p1.id, { quantity: 2 })
      await createCartItem(c.id, p2.id, { quantity: 1 })

      const result = await getCheckoutSummaryQuery(c.id, 'user-1')
      expect(result?.shops[0].subtotalCents).toBe(4000)
      expect(result?.grandTotalCents).toBe(4000)
    })

    it('calculates grand total and VAT estimate using selected shipping options when selections are provided', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ id: 'prod-1', priceCents: 1000 })

      await createCartItem(c.id, p.id, { quantity: 1 })

      const resDefault = await getCheckoutSummaryQuery(c.id, 'user-1', {
        name: 'Test',
        street: 'St',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      })
      const standardOption = resDefault?.shops[0].shippingOptions.find(
        (o) => o.method === 'standard',
      )
      const expressOption = resDefault?.shops[0].shippingOptions.find((o) => o.method === 'express')
      expect(standardOption).toBeDefined()
      expect(expressOption).toBeDefined()

      expect(resDefault?.grandTotalCents).toBe(1000 + (standardOption?.costCents ?? 0))

      const resExpress = await getCheckoutSummaryQuery(
        c.id,
        'user-1',
        {
          name: 'Test',
          street: 'St',
          city: 'Paris',
          postalCode: '75001',
          country: 'FR',
        },
        [
          {
            shopId: 'shop-1',
            rateId: expressOption?.rateId,
            method: 'express',
            costCents: expressOption?.costCents ?? 0,
          },
        ],
      )
      expect(resExpress?.grandTotalCents).toBe(1000 + (expressOption?.costCents ?? 0))
    })

    it('groups items from multiple shops separately', async () => {
      await seedUser()
      await seedShop()
      const shop2 = await seedShop({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop' })
      const c = await createCart('user-1')
      const p1 = await seedProduct({ id: 'prod-1', shopId: 'shop-1', priceCents: 1000 })
      const p2 = await seedProduct({
        id: 'prod-2',
        name: 'Bowl',
        slug: 'bowl',
        shopId: shop2.id,
        priceCents: 2000,
      })

      await createCartItem(c.id, p1.id, { quantity: 1 })
      await createCartItem(c.id, p2.id, { quantity: 1 })

      const result = await getCheckoutSummaryQuery(c.id, 'user-1')
      expect(result?.shops).toHaveLength(2)
      const shop1Group = result?.shops.find((s) => s.shopId === 'shop-1')
      const shop2Group = result?.shops.find((s) => s.shopId === 'shop-2')
      expect(shop1Group?.subtotalCents).toBe(1000)
      expect(shop2Group?.subtotalCents).toBe(2000)
      expect(result?.grandTotalCents).toBe(3000)
    })

    it('skips unavailable items in checkout summary', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 2 })
      await db.delete(product).where(eq(product.id, p.id))

      const result = await getCheckoutSummaryQuery(c.id, 'user-1')
      expect(result).not.toBeNull()
      expect(result?.shops).toHaveLength(0)
      expect(result?.grandTotalCents).toBe(0)
    })
  })

  describe('createCheckoutQuery', () => {
    function makeInput(cartId: string, overrides?: Partial<CheckoutInput>): CheckoutInput {
      return {
        cartId,
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
        shippingAddress: {
          name: 'Test User',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
          pickupPoint: {
            id: 'DE-10115-01',
            name: 'Packstation - Edeka',
            street: 'Friedrichstraße 50',
            postalCode: '10115',
            city: 'Berlin',
            country: 'DE',
          },
        },
        billingAddress: {
          name: 'Test User',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        ...overrides,
      }
    }

    it('throws 404 when cart does not exist', async () => {
      const input = makeInput('550e8400-e29b-41d4-a716-446655440000')

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(404)
      }
    })

    it('throws 404 when cart belongs to another user', async () => {
      await seedUser()
      const otherUser = await seedUser({ id: 'user-2', name: 'Other', email: 'other@example.com' })
      const c = await createCart(otherUser.id)
      const input = makeInput(c.id)

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(404)
      }
    })

    it('throws 409 when cart is empty', async () => {
      await seedUser()
      const c = await createCart('user-1')
      const input = makeInput(c.id)

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(409)
      }
    })

    it('throws 409 with productIds when stock is exhausted', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ stockCount: 1 })

      await createCartItem(c.id, p.id, { quantity: 5 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 708 }],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(409)
        const body = await (err as Response).json()
        expect(body.productIds).toEqual([p.id])
      }
    })

    it('throws 409 with multiple productIds when multiple items are out of stock', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p1 = await seedProduct({ id: 'prod-1', stockCount: 1 })
      const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', stockCount: 0 })

      await createCartItem(c.id, p1.id, { quantity: 5 })
      await createCartItem(c.id, p2.id, { quantity: 1 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 750 }],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(409)
        const body = await (err as Response).json()
        expect(body.productIds).toContain(p1.id)
        expect(body.productIds).toContain(p2.id)
        expect(body.productIds).toHaveLength(2)
      }
    })

    it('throws 400 when shipping selection is missing for a shop', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id, { shippingSelections: [] })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
      }
    })

    it('creates platform_order, shop_order, and order_item records', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 2 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 580 }],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      expect(result.platformOrderId).toBeDefined()

      const platformOrders = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, result.platformOrderId))
      expect(platformOrders).toHaveLength(1)
      expect(platformOrders[0].userId).toBe('user-1')
      expect(platformOrders[0].totalCents).toBe(2580) // 2 * 1000 + 580 (provider standard)
      expect(platformOrders[0].status).toBe('pending_payment')
      expect(decryptJsonb(platformOrders[0].shippingAddress)).toEqual(
        expect.objectContaining({
          name: 'Test User',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        }),
      )
      expect(decryptJsonb(platformOrders[0].billingAddress)).toEqual({
        name: 'Test User',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      })

      const shopOrders = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.platformOrderId, result.platformOrderId))
      expect(shopOrders).toHaveLength(1)
      expect(shopOrders[0].shopId).toBe('shop-1')
      expect(shopOrders[0].shippingMethod).toBe('standard')
      expect(shopOrders[0].shippingCostCents).toBe(580)
      expect(shopOrders[0].subtotalCents).toBe(2000)
      expect(shopOrders[0].status).toBe('pending_payment')

      const orderItems = await db
        .select()
        .from(orderItem)
        .where(eq(orderItem.shopOrderId, shopOrders[0].id))
      expect(orderItems).toHaveLength(1)
      expect(orderItems[0].productId).toBe(p.id)
      expect(orderItems[0].productName).toBe('Vase')
      expect(orderItems[0].unitPriceCents).toBe(1000)
      expect(orderItems[0].quantity).toBe(2)
      expect(orderItems[0].totalCents).toBe(2000)
    })

    it('uses express shipping cost when selected', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'express', costCents: 861 }],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const platformOrders = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, result.platformOrderId))
      expect(platformOrders[0].totalCents).toBe(1861) // 1000 + 861 express (provider)

      const shopOrders = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.platformOrderId, result.platformOrderId))
      expect(shopOrders[0].shippingMethod).toBe('express')
      expect(shopOrders[0].shippingCostCents).toBe(861)
    })

    it('creates multiple shop_orders for multi-shop carts', async () => {
      await seedUser()
      await seedShop()
      const shop2 = await seedShop({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop' })
      const c = await createCart('user-1')
      const p1 = await seedProduct({ id: 'prod-1', shopId: 'shop-1', priceCents: 1000 })
      const p2 = await seedProduct({
        id: 'prod-2',
        name: 'Bowl',
        slug: 'bowl',
        shopId: shop2.id,
        priceCents: 2000,
      })

      await createCartItem(c.id, p1.id, { quantity: 1 })
      await createCartItem(c.id, p2.id, { quantity: 1 })

      const input = makeInput(c.id, {
        shippingSelections: [
          { shopId: 'shop-1', method: 'standard', costCents: 538 },
          { shopId: 'shop-2', method: 'express', costCents: 861 },
        ],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const platformOrders = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, result.platformOrderId))
      expect(platformOrders[0].totalCents).toBe(4399) // 1000+538 + 2000+861 (provider)

      const shopOrdersResult = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.platformOrderId, result.platformOrderId))
      expect(shopOrdersResult).toHaveLength(2)

      const so1 = shopOrdersResult.find((so) => so.shopId === 'shop-1')
      const so2 = shopOrdersResult.find((so) => so.shopId === 'shop-2')
      expect(so1?.subtotalCents).toBe(1000)
      expect(so1?.shippingCostCents).toBe(538)
      expect(so2?.subtotalCents).toBe(2000)
      expect(so2?.shippingCostCents).toBe(861)
    })

    it('clears cart and items after successful order creation', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)
      await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const cartsAfter = await db.select().from(cart).where(eq(cart.id, c.id))
      expect(cartsAfter).toHaveLength(0)

      const itemsAfter = await db.select().from(cartItem).where(eq(cartItem.cartId, c.id))
      expect(itemsAfter).toHaveLength(0)
    })

    it('returns platformOrderId and checkoutUrl on success', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      expect(result.platformOrderId).toBeDefined()
      expect(typeof result.platformOrderId).toBe('string')
      expect(result.checkoutUrl).toBeDefined()
      expect(typeof result.checkoutUrl).toBe('string')
    })

    it('stores molliePaymentId on the platform order', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const [order] = await db
        .select({ molliePaymentId: platformOrder.molliePaymentId })
        .from(platformOrder)
        .where(eq(platformOrder.id, result.platformOrderId))

      expect(order.molliePaymentId).toBeTruthy()
      expect(order.molliePaymentId).toMatch(/^test_payment_/)
    })

    it('keeps order in pending_payment and retains stock when payment provider fails', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ stockCount: 5 })

      await createCartItem(c.id, p.id, { quantity: 2 })

      const failingProvider: PaymentProvider = {
        createPayment: async () => {
          throw new Error('Simulated provider failure')
        },
        verifyWebhook: async () => false,
        getPaymentStatus: async () => 'paid',
        getPaymentAmount: async () => 1000,
        refundPayment: async () => undefined,
        cancelPayment: async () => undefined,
      }

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 580 }],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', failingProvider)
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(503)
      }

      // Order should remain in pending_payment so the buyer can retry
      const platformOrders = await db.select().from(platformOrder)
      expect(platformOrders).toHaveLength(1)
      expect(platformOrders[0].status).toBe('pending_payment')

      // Inventory should remain reserved
      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.productId, p.id))
      expect(reservations).toHaveLength(1)
      expect(reservations[0].platformOrderId).toBe(platformOrders[0].id)
      expect(reservations[0].quantity).toBe(2)
    })

    it('does not trust client-provided totals', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ priceCents: 1234 })

      await createCartItem(c.id, p.id, { quantity: 3 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 623 }],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const platformOrders = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, result.platformOrderId))
      // 3 * 1234 + 623 (provider standard for 1500g) = 4325
      expect(platformOrders[0].totalCents).toBe(4325)
    })

    it('creates inventory reservations for every cart item', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 2 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 580 }],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, result.platformOrderId))

      expect(reservations).toHaveLength(1)
      expect(reservations[0].productId).toBe(p.id)
      expect(reservations[0].quantity).toBe(2)
    })

    it('throws 409 when existing reservations reduce available stock below cart quantity', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ stockCount: 10 })

      await createCartItem(c.id, p.id, { quantity: 8 })

      // Another order reserves 5 units
      const otherOrder = await createPlatformOrder('user-1', {
        totalCents: 1000,
        status: 'pending_payment',
      })

      await createInventoryReservation(p.id, {
        platformOrderId: otherOrder.id,
        quantity: 5,
        expiresAt: new Date(Date.now() + 60_000),
      })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 835 }],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(409)
        const body = await (err as Response).json()
        expect(body.productIds).toEqual([p.id])
      }
    })

    it('creates reservations for items from multiple shops', async () => {
      await seedUser()
      await seedShop()
      const shop2 = await seedShop({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop' })
      const c = await createCart('user-1')
      const p1 = await seedProduct({ id: 'prod-1', shopId: 'shop-1', priceCents: 1000 })
      const p2 = await seedProduct({
        id: 'prod-2',
        name: 'Bowl',
        slug: 'bowl',
        shopId: shop2.id,
        priceCents: 2000,
      })

      await createCartItem(c.id, p1.id, { quantity: 1 })
      await createCartItem(c.id, p2.id, { quantity: 2 })

      const input = makeInput(c.id, {
        shippingSelections: [
          { shopId: 'shop-1', method: 'standard', costCents: 538 },
          { shopId: 'shop-2', method: 'express', costCents: 928 },
        ],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, result.platformOrderId))

      expect(reservations).toHaveLength(2)
      const r1 = reservations.find((r) => r.productId === p1.id)
      const r2 = reservations.find((r) => r.productId === p2.id)
      expect(r1?.quantity).toBe(1)
      expect(r2?.quantity).toBe(2)
    })

    it('throws 503 when shipping provider is down/unavailable', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ id: 'prod-1', shopId: 'shop-1', priceCents: 1000 })
      await createCartItem(c.id, p.id, { quantity: 1 })

      // Force shipping provider to throw an error
      const spy = vi
        .spyOn(getShippingProvider(), 'getRates')
        .mockRejectedValue(new Error('Network error'))

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown 503')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        const res = err as Response
        expect(res.status).toBe(503)
        const body = await res.json()
        expect(body.error).toBe('Service Unavailable')
        expect(body.message).toBe('Shipping rates are temporarily unavailable. Please try again.')
      } finally {
        spy.mockRestore()
      }

      // Verify order was NOT created
      const platformOrders = await db.select().from(platformOrder)
      expect(platformOrders).toHaveLength(0)
    })

    it('succeeds when all items and shops are active', async () => {
      await seedUser()
      await seedShop({ status: 'active' })
      const c = await createCart('user-1')
      const p = await seedProduct({ isActive: true })

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      expect(result.platformOrderId).toBeDefined()
      expect(result.checkoutUrl).toBeDefined()
    })

    it('throws 400 when a product is inactive', async () => {
      await seedUser()
      await seedShop({ status: 'active' })
      const c = await createCart('user-1')
      const p = await seedProduct({ isActive: false })

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('One or more items in your cart are no longer available.')
      }
    })

    it('throws 400 when a shop is suspended', async () => {
      await seedUser()
      await seedShop({ status: 'active', isSuspended: true })
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('One or more items in your cart are no longer available.')
      }
    })

    it('throws 400 when a shop status is not active', async () => {
      await seedUser()
      await seedShop({ status: 'pending_review' })
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id)

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('One or more items in your cart are no longer available.')
      }
    })

    it('throws 400 when shipping rateId does not match any available option', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id, {
        shippingSelections: [
          { shopId: 'shop-1', method: 'standard', rateId: 'fake-rate-id', costCents: 538 },
        ],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('Invalid shipping selection for shop shop-1')
      }
    })

    it('throws 400 when shipping method does not match any available option', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'express', costCents: 861 }],
      })

      // Force provider to return only standard rates so express is not available
      const spy = vi.spyOn(getShippingProvider(), 'getRates').mockResolvedValue([
        {
          rateId: 'sendcloud_std_test',
          carrier: 'sendcloud',
          serviceName: 'Sendcloud Standard',
          priceCents: 538,
          estimatedDays: { min: 2, max: 4 },
        },
      ])

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('Invalid shipping selection for shop shop-1')
      } finally {
        spy.mockRestore()
      }
    })

    it('throws 400 when shipping costCents does not match the quoted option', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 999 }],
      })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('Shipping cost mismatch for shop shop-1')
      }
    })

    it('throws 400 when user tries to skip shipping selection entirely', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct()

      await createCartItem(c.id, p.id, { quantity: 1 })

      const input = makeInput(c.id, { shippingSelections: [] })

      try {
        await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(400)
        const body = await (err as Response).json()
        expect(body.message).toBe('Missing shipping selection for shop shop-1')
      }
    })

    it('prevents deadlocks by reserving overlapping products in deterministic order', async () => {
      await seedUser()
      await seedShop()
      const p1 = await seedProduct({
        id: 'prod-a',
        name: 'Product A',
        slug: 'product-a',
        stockCount: 10,
      })
      const p2 = await seedProduct({
        id: 'prod-b',
        name: 'Product B',
        slug: 'product-b',
        stockCount: 10,
      })

      const user2 = await seedUser({ id: 'user-2', name: 'User 2', email: 'user2@example.com' })

      // Cart 1: product A then product B
      const c1 = await createCart('user-1')
      await createCartItem(c1.id, p1.id, { quantity: 1 })
      await createCartItem(c1.id, p2.id, { quantity: 1 })

      // Cart 2: product B then product A (opposite insertion order)
      const c2 = await createCart(user2.id)
      await createCartItem(c2.id, p2.id, { quantity: 1 })
      await createCartItem(c2.id, p1.id, { quantity: 1 })

      const input1 = makeInput(c1.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 580 }],
      })
      const input2 = makeInput(c2.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 580 }],
      })

      // Both checkouts run concurrently; deterministic lock ordering prevents deadlocks.
      const [result1, result2] = await Promise.all([
        createCheckoutWithProvider(input1, 'user-1', createStubPaymentProvider()),
        createCheckoutWithProvider(input2, 'user-2', createStubPaymentProvider()),
      ])

      expect(result1.platformOrderId).toBeDefined()
      expect(result2.platformOrderId).toBeDefined()

      // Verify reservations were created for both orders
      const reservations = await db.select().from(inventoryReservation)
      expect(reservations).toHaveLength(4)

      const r1 = reservations.filter((r) => r.platformOrderId === result1.platformOrderId)
      const r2 = reservations.filter((r) => r.platformOrderId === result2.platformOrderId)
      expect(r1).toHaveLength(2)
      expect(r2).toHaveLength(2)
    })

    it('succeeds when cart reservations exist (releases them before order reservations)', async () => {
      await seedUser()
      await seedShop()
      const c = await createCart('user-1')
      const p = await seedProduct({ stockCount: 5 })

      // Create a cart reservation by using addItemToCart (quantity 2 matches the
      // mock shipping provider's standard rate of 580 cents for 1000g).
      const { addItemToCart } = await import('./cart.server')
      await addItemToCart(c.id, p.id, 2)

      // Verify cart reservation exists
      const cartReservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.cartId, c.id))
      expect(cartReservations).toHaveLength(1)
      expect(cartReservations[0].quantity).toBe(2)

      const input = makeInput(c.id, {
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 580 }],
      })
      const result = await createCheckoutWithProvider(input, 'user-1', createStubPaymentProvider())

      expect(result.platformOrderId).toBeDefined()

      // Cart should be deleted
      const cartsAfter = await db.select().from(cart).where(eq(cart.id, c.id))
      expect(cartsAfter).toHaveLength(0)

      // Cart reservation should be gone (cascade-deleted with cart)
      const reservationsAfter = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.cartId, c.id))
      expect(reservationsAfter).toHaveLength(0)

      // Order reservation should exist
      const orderReservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, result.platformOrderId))
      expect(orderReservations).toHaveLength(1)
      expect(orderReservations[0].quantity).toBe(2)
    })
  })

  describe('retryPayment', () => {
    it('throws 404 for nonexistent platform order', async () => {
      try {
        await retryPayment(
          '550e8400-e29b-41d4-a716-446655440000',
          'user-1',
          createStubPaymentProvider(),
        )
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(404)
      }
    })

    it('throws 403 when order belongs to another user', async () => {
      await seedUser()
      await seedShop()
      const otherUser = await seedUser({ id: 'user-2', name: 'Other', email: 'other@example.com' })

      const order = await createPlatformOrder(otherUser.id, {
        totalCents: 1000,
        status: 'pending_payment',
      })

      try {
        await retryPayment(order.id, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(403)
      }
    })

    it('throws 409 when order is not pending_payment', async () => {
      await seedUser()
      await seedShop()

      const order = await createPlatformOrder('user-1', {
        totalCents: 1000,
        status: 'paid',
      })

      try {
        await retryPayment(order.id, 'user-1', createStubPaymentProvider())
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(409)
      }
    })

    it('creates a new payment and returns checkoutUrl for a pending order', async () => {
      await seedUser()
      await seedShop()

      const order = await createPlatformOrder('user-1', {
        totalCents: 2580,
        status: 'pending_payment',
      })

      const result = await retryPayment(order.id, 'user-1', createStubPaymentProvider())

      expect(result.checkoutUrl).toBeDefined()
      expect(typeof result.checkoutUrl).toBe('string')

      const [updated] = await db
        .select({ molliePaymentId: platformOrder.molliePaymentId })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))

      expect(updated.molliePaymentId).toBeTruthy()
      expect(updated.molliePaymentId).toMatch(/^test_payment_/)
    })

    it('throws 503 when payment provider fails on retry', async () => {
      await seedUser()
      await seedShop()

      const order = await createPlatformOrder('user-1', {
        totalCents: 1000,
        status: 'pending_payment',
      })

      const failingProvider: PaymentProvider = {
        createPayment: async () => {
          throw new Error('Simulated provider failure')
        },
        verifyWebhook: async () => false,
        getPaymentStatus: async () => 'paid',
        getPaymentAmount: async () => 1000,
        refundPayment: async () => undefined,
        cancelPayment: async () => undefined,
      }

      try {
        await retryPayment(order.id, 'user-1', failingProvider)
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err instanceof Response).toBe(true)
        expect((err as Response).status).toBe(503)
      }

      // Order should still be pending_payment
      const [updated] = await db.select().from(platformOrder).where(eq(platformOrder.id, order.id))
      expect(updated.status).toBe('pending_payment')
    })

    it('replaces the old molliePaymentId on successful retry', async () => {
      await seedUser()
      await seedShop()

      const order = await createPlatformOrder('user-1', {
        totalCents: 1000,
        status: 'pending_payment',
        molliePaymentId: 'old_payment_id',
      })

      const result = await retryPayment(order.id, 'user-1', createStubPaymentProvider())

      expect(result.checkoutUrl).toBeDefined()

      const [updated] = await db
        .select({ molliePaymentId: platformOrder.molliePaymentId })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))

      expect(updated.molliePaymentId).not.toBe('old_payment_id')
      expect(updated.molliePaymentId).toMatch(/^test_payment_/)
    })
  })
})
