import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  invoices,
  inventoryReservation,
  orderItem,
  payout,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { createInvoicesForPlatformOrder } from './invoices.server'
import { refundShopOrderQuery } from './shop-orders.server'
import { flushBackgroundWorkForTests } from './background-work.server'

const OWNER_ID = randomUUID()
const BUYER_ID = randomUUID()
const SHOP_ID = randomUUID()
const PRODUCT_ID = randomUUID()
const PO_ID = randomUUID()
const SO_ID = randomUUID()
const OI_ID = randomUUID()

describe('refundShopOrderQuery', () => {
  beforeEach(async () => {
    await db.delete(invoices)
    await db.delete(payout)
    await db.delete(orderItem)
    await db.delete(inventoryReservation)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  async function seedRefundFixture(options?: {
    payoutStatus?: 'pending' | 'sent' | 'in_transit'
    productStockCount?: number
    reservedQuantity?: number
  }) {
    const [owner] = await db
      .insert(user)
      .values({
        id: OWNER_ID,
        name: 'Owner',
        email: 'owner@example.com',
        role: 'creator',
        emailVerified: true,
      })
      .returning()

    const [buyer] = await db
      .insert(user)
      .values({
        id: BUYER_ID,
        name: 'Buyer',
        email: 'buyer@example.com',
        role: 'customer',
      })
      .returning()

    const [shopRecord] = await db
      .insert(shop)
      .values({
        id: SHOP_ID,
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: owner.id,
        mollieAccountId: 'org_test',
      })
      .returning()

    const [prod] = await db
      .insert(product)
      .values({
        id: PRODUCT_ID,
        name: 'Vase',
        slug: 'vase',
        priceCents: 1000,
        shopId: shopRecord.id,
        stockCount: options?.productStockCount ?? 5,
      })
      .returning()

    const [po] = await db
      .insert(platformOrder)
      .values({
        id: PO_ID,
        userId: buyer.id,
        shippingAddress: { name: 'Buyer', country: 'FR' },
        billingAddress: { name: 'Buyer', country: 'FR' },
        totalCents: 1200,
        status: 'paid',
        molliePaymentId: 'tr_mock_000001',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        id: SO_ID,
        platformOrderId: po.id,
        shopId: shopRecord.id,
        shippingMethod: 'standard',
        shippingCostCents: 200,
        subtotalCents: 1000,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values({
      id: OI_ID,
      shopOrderId: so.id,
      productId: prod.id,
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 2,
      totalCents: 2000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    if (options?.reservedQuantity) {
      await db.insert(inventoryReservation).values({
        productId: prod.id,
        platformOrderId: po.id,
        quantity: options.reservedQuantity,
        expiresAt: new Date(Date.now() + 60_000),
      })
    }

    await createInvoicesForPlatformOrder(po.id)

    if (options?.payoutStatus) {
      await db.insert(payout).values({
        shopOrderId: so.id,
        shopId: shopRecord.id,
        amountCents: 900,
        status: options.payoutStatus,
        molliePaymentId: 'tr_test',
      })
    }

    return { owner, buyer, shop: shopRecord, product: prod, platformOrder: po, shopOrder: so }
  }

  it('refunds a paid shop order and creates a credit note', async () => {
    const {
      owner,
      product: prod,
      shopOrder: so,
      platformOrder: po,
    } = await seedRefundFixture({
      productStockCount: 3,
      reservedQuantity: 2,
    })

    const result = await refundShopOrderQuery(owner.id, so.id)

    expect(result.success).toBe(true)
    expect(result.shopOrderId).toBe(so.id)
    expect(result.creditNoteNumber).toMatch(/^CN-\d{4}-\d{5}$/)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')
    expect(updatedSo.refundedCents).toBe(1000)

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.refundedCents).toBe(1000)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(5)

    const reservation = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, po.id))
    expect(reservation).toHaveLength(0)

    const creditNote = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, result.creditNoteNumber ?? ''))
    expect(creditNote).toHaveLength(1)
    expect(creditNote[0].type).toBe('credit_note')
    expect(creditNote[0].totalCents).toBeLessThan(0)

    await flushBackgroundWorkForTests()
  })

  it('reverses an already sent payout during refund', async () => {
    const { owner, shopOrder: so } = await seedRefundFixture({ payoutStatus: 'sent' })

    await refundShopOrderQuery(owner.id, so.id)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord.status).toBe('reversed')
    expect(payoutRecord.reversalReason).toBe('owner_refund')
  })

  it('throws 404 when the caller does not own the shop', async () => {
    const { shopOrder: so } = await seedRefundFixture()

    await expect(refundShopOrderQuery('stranger-id', so.id)).rejects.toThrow()
  })

  it('throws 409 when the shop order is already refunded', async () => {
    const { owner, shopOrder: so } = await seedRefundFixture()
    await db.update(shopOrder).set({ status: 'refunded' }).where(eq(shopOrder.id, so.id))

    await expect(refundShopOrderQuery(owner.id, so.id)).rejects.toThrow()
  })

  it('throws when the parent payment is not available', async () => {
    const { owner, platformOrder: po, shopOrder: so } = await seedRefundFixture()
    await db.update(platformOrder).set({ molliePaymentId: null }).where(eq(platformOrder.id, po.id))

    await expect(refundShopOrderQuery(owner.id, so.id)).rejects.toThrow()
  })
})
