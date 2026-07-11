import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { cart, cartItem, orderItem, platformOrder, product, shop, shopOrder } from '#/db/schema'
import { encryptJsonb } from '../encryption.server'
import { recalcPlatformOrderTree } from '../financial-totals.server'
import { generateUniqueOrderNumber } from '../order-numbers.server'
import {
  getAvailableStockForProductsInTx,
  InsufficientStockError,
  releaseCartStockInTx,
  reserveStockInTx,
} from '../inventory.server'
import type { CheckoutInput } from './types'
import {
  calculateCheckoutLineTotals,
  calculateCheckoutShippingTotals,
  isCrossBorderB2b,
  validateCrossBorderBuyerVatId,
} from './tax.server'

export interface CreatedCheckoutShopOrder {
  shopOrderId: string
  shopId: string
}

export interface PersistedCheckoutOrder {
  platformOrderId: string
  orderNumber: string
  createdShopOrders: CreatedCheckoutShopOrder[]
  grandTotalCents: number
}

/**
 * Persist a fully validated checkout. This function owns the database
 * transaction, including deterministic inventory locking and reservation
 * transfer from cart to order. Provider calls intentionally remain outside
 * this transaction.
 */
export async function persistCheckoutOrder(
  input: CheckoutInput,
  userId: string,
  shippingCostByShop: Map<string, number>,
): Promise<PersistedCheckoutOrder> {
  return db.transaction(async (tx) => {
    const items = await tx
      .select({
        item: cartItem,
        product,
        shopRecord: shop,
      })
      .from(cartItem)
      .leftJoin(product, eq(cartItem.productId, product.id))
      .leftJoin(shop, eq(product.shopId, shop.id))
      .where(eq(cartItem.cartId, input.cartId))

    const productIdsToLock = Array.from(
      new Set(items.map((row) => row.product?.id).filter((id): id is string => !!id)),
    )
    productIdsToLock.sort()
    for (const productId of productIdsToLock) {
      await tx.select().from(product).where(eq(product.id, productId)).for('update')
    }

    if (items.length === 0) {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Cart is empty', code: 'CART_EMPTY' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    for (const row of items) {
      if (
        !row.product ||
        !row.shopRecord ||
        row.product.status !== 'published' ||
        !row.product.isActive ||
        row.shopRecord.status !== 'active' ||
        row.shopRecord.isSuspended
      ) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Request',
            message: 'One or more items in your cart are no longer available.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    // Release cart reservations before validating stock so the cart's own
    // reservations are not double-counted against available inventory.
    await releaseCartStockInTx(tx, input.cartId)

    const productIds = items.map((row) => row.product?.id).filter((id): id is string => !!id)
    // Use the same transaction so the released cart reservations are visible
    // to this stock check and no stale connection can reject a valid checkout.
    const availableStockMap = await getAvailableStockForProductsInTx(tx, productIds)

    const outOfStockProductIds: string[] = []
    for (const row of items) {
      if (!row.product) {
        outOfStockProductIds.push(row.item.productId)
        continue
      }
      const availableStock = availableStockMap.get(row.product.id) ?? 0
      if (availableStock < row.item.quantity) {
        outOfStockProductIds.push(row.product.id)
      }
    }

    if (outOfStockProductIds.length > 0) {
      throw new Response(
        JSON.stringify({
          error: 'Conflict',
          message: 'Some items are out of stock',
          code: 'ITEMS_OUT_OF_STOCK',
          productIds: outOfStockProductIds,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const selectionMap = new Map(
      input.shippingSelections.map((selection) => [selection.shopId, selection]),
    )
    const shopGroups = new Map<
      string,
      {
        shopId: string
        items: Array<{
          product: typeof product.$inferSelect
          quantity: number
          unitPriceCents: number
          lineTotalCents: number
          vatRateBasisPoints: number
          vatAmountCents: number
        }>
        subtotalCents: number
        vatAmountCents: number
        shippingVatRateBasisPoints: number
        shippingVatAmountCents: number
      }
    >()

    for (const row of items) {
      const productRecord = row.product
      const shopRecord = row.shopRecord
      if (!productRecord || !shopRecord) continue

      const sellerCountry =
        (shopRecord.shippingOrigin as { country?: string } | null)?.country ?? ''
      const reverseChargeApplies = isCrossBorderB2b(
        sellerCountry,
        input.billingAddress.country,
        shopRecord.isVatRegistered,
        input.billingAddress.vatId,
      )

      const existing = shopGroups.get(productRecord.shopId)
      if (!existing && reverseChargeApplies) {
        await validateCrossBorderBuyerVatId(
          sellerCountry,
          input.billingAddress.country,
          shopRecord.isVatRegistered,
          input.billingAddress.vatId,
        )
      }

      const lineTotals = calculateCheckoutLineTotals({
        sellerCountry,
        buyerCountry: input.shippingAddress.country,
        isSellerVatRegistered: shopRecord.isVatRegistered,
        buyerVatId: input.billingAddress.vatId,
        reverseChargeApplies,
        vatRateCategory:
          (productRecord.vatRateCategory as 'standard' | 'reduced' | 'exempt') ?? 'standard',
        unitPriceCents: productRecord.priceCents,
        quantity: row.item.quantity,
      })

      if (existing) {
        existing.items.push({
          product: productRecord,
          quantity: row.item.quantity,
          unitPriceCents: lineTotals.unitPriceCents,
          lineTotalCents: lineTotals.lineTotalCents,
          vatRateBasisPoints: lineTotals.vatRateBasisPoints,
          vatAmountCents: lineTotals.vatAmountCents,
        })
        existing.subtotalCents += lineTotals.lineTotalCents
        existing.vatAmountCents += lineTotals.vatAmountCents
        continue
      }

      const shippingTotals = calculateCheckoutShippingTotals({
        sellerCountry,
        buyerCountry: input.shippingAddress.country,
        isSellerVatRegistered: shopRecord.isVatRegistered,
        buyerVatId: input.billingAddress.vatId,
        reverseChargeApplies,
        shippingCostCents: shippingCostByShop.get(productRecord.shopId) ?? 0,
      })
      shippingCostByShop.set(productRecord.shopId, shippingTotals.shippingCostCents)

      shopGroups.set(productRecord.shopId, {
        shopId: productRecord.shopId,
        items: [
          {
            product: productRecord,
            quantity: row.item.quantity,
            unitPriceCents: lineTotals.unitPriceCents,
            lineTotalCents: lineTotals.lineTotalCents,
            vatRateBasisPoints: lineTotals.vatRateBasisPoints,
            vatAmountCents: lineTotals.vatAmountCents,
          },
        ],
        subtotalCents: lineTotals.lineTotalCents,
        vatAmountCents: lineTotals.vatAmountCents,
        shippingVatRateBasisPoints: shippingTotals.vatRateBasisPoints,
        shippingVatAmountCents: shippingTotals.vatAmountCents,
      })
    }

    let grandTotalCents = 0
    for (const group of shopGroups.values()) {
      grandTotalCents += group.subtotalCents + (shippingCostByShop.get(group.shopId) ?? 0)
    }

    const orderNumber = await generateUniqueOrderNumber()
    const [platformOrderRecord] = await tx
      .insert(platformOrder)
      .values({
        userId,
        orderNumber,
        shippingAddress: encryptJsonb(input.shippingAddress),
        billingAddress: encryptJsonb(input.billingAddress),
        totalCents: grandTotalCents,
        status: 'pending_payment',
      })
      .returning()

    const createdShopOrders = await Promise.all(
      Array.from(shopGroups.values()).map(async (group) => {
        const selection = selectionMap.get(group.shopId)
        const shippingMethod = selection?.method ?? 'standard'
        const shippingCostCents = shippingCostByShop.get(group.shopId) ?? 0

        const [shopOrderRecord] = await tx
          .insert(shopOrder)
          .values({
            platformOrderId: platformOrderRecord.id,
            shopId: group.shopId,
            shippingMethod,
            shippingRateId: selection?.rateId ?? null,
            shippingCostCents,
            subtotalCents: group.subtotalCents,
            vatAmountCents: group.vatAmountCents,
            shippingVatRateBasisPoints: group.shippingVatRateBasisPoints,
            shippingVatAmountCents: group.shippingVatAmountCents,
            status: 'pending_payment',
          })
          .returning()

        await Promise.all(
          group.items.map((lineItem) =>
            tx.insert(orderItem).values({
              shopOrderId: shopOrderRecord.id,
              productId: lineItem.product.id,
              productName: lineItem.product.name,
              unitPriceCents: lineItem.unitPriceCents,
              quantity: lineItem.quantity,
              totalCents: lineItem.lineTotalCents,
              vatRateBasisPoints: lineItem.vatRateBasisPoints,
              vatAmountCents: lineItem.vatAmountCents,
              weightGrams: lineItem.product.weightGrams,
              lengthCm: lineItem.product.lengthCm,
              widthCm: lineItem.product.widthCm,
              heightCm: lineItem.product.heightCm,
            }),
          ),
        )

        return { shopOrderId: shopOrderRecord.id, shopId: group.shopId }
      }),
    )

    await recalcPlatformOrderTree(tx, platformOrderRecord.id)

    const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const allLineItems = Array.from(shopGroups.values()).flatMap((group) => group.items)
    allLineItems.sort((left, right) => left.product.id.localeCompare(right.product.id))
    for (const lineItem of allLineItems) {
      try {
        await reserveStockInTx(
          tx,
          lineItem.product.id,
          platformOrderRecord.id,
          lineItem.quantity,
          reservationExpiresAt,
        )
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          throw new Response(
            JSON.stringify({
              error: 'Conflict',
              message: 'Some items are out of stock',
              code: 'ITEMS_OUT_OF_STOCK',
              productIds: [lineItem.product.id],
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          )
        }
        throw error
      }
    }

    await tx.delete(cartItem).where(eq(cartItem.cartId, input.cartId))
    await tx.delete(cart).where(eq(cart.id, input.cartId))

    const [updatedOrder] = await tx
      .select({ totalCents: platformOrder.totalCents })
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderRecord.id))
    const finalGrandTotalCents = updatedOrder?.totalCents ?? grandTotalCents

    return {
      platformOrderId: platformOrderRecord.id,
      orderNumber: platformOrderRecord.orderNumber,
      createdShopOrders,
      grandTotalCents: finalGrandTotalCents,
    }
  })
}
