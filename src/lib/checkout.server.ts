import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  cart,
  cartItem,
  orderItem,
  platformOrder,
  product,
  productImage,
  shop,
  shopOrder,
} from '#/db/schema'
import {
  getAvailableStockForProducts,
  InsufficientStockError,
  reserveStockInTx,
} from './inventory.server'

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface ShippingOption {
  method: 'standard' | 'express'
  costCents: number
  label: string
}

export interface CheckoutItem {
  productId: string
  name: string
  slug: string
  priceCents: number
  quantity: number
  imageUrl: string | null
}

export interface CheckoutShopGroup {
  shopId: string
  shopName: string
  shopSlug: string
  items: CheckoutItem[]
  subtotalCents: number
  shippingOptions: ShippingOption[]
}

export interface CheckoutSummary {
  cartId: string
  shops: CheckoutShopGroup[]
  grandTotalCents: number
}

export interface ShippingSelection {
  shopId: string
  method: 'standard' | 'express'
}

export interface ShippingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
}

export interface CheckoutInput {
  cartId: string
  shippingSelections: ShippingSelection[]
  shippingAddress: ShippingAddress
  billingAddress: ShippingAddress
}

/* -------------------------------------------------------------------------- */
/*                               Shipping Costs                               */
/* -------------------------------------------------------------------------- */

const SHIPPING_OPTIONS: ShippingOption[] = [
  { method: 'standard', costCents: 500, label: 'Standard' },
  { method: 'express', costCents: 1000, label: 'Express' },
]

export function getShippingCost(method: 'standard' | 'express'): number {
  return method === 'express' ? 1000 : 500
}

/* -------------------------------------------------------------------------- */
/*                            getCheckoutSummary                              */
/* -------------------------------------------------------------------------- */

export async function getCheckoutSummaryQuery(
  cartId: string,
  userId: string,
): Promise<CheckoutSummary | null> {
  // Verify cart ownership
  const [cartRecord] = await db.select().from(cart).where(eq(cart.id, cartId)).limit(1)
  if (!cartRecord || cartRecord.userId !== userId) {
    return null
  }

  const items = await db
    .select({
      item: cartItem,
      product: product,
      shop: shop,
    })
    .from(cartItem)
    .leftJoin(product, eq(cartItem.productId, product.id))
    .leftJoin(shop, eq(product.shopId, shop.id))
    .where(eq(cartItem.cartId, cartId))

  const productIds = items.map((r) => r.product?.id).filter((id): id is string => !!id)

  const images =
    productIds.length > 0
      ? await db
          .select()
          .from(productImage)
          .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))
      : []

  const imageByProduct = new Map<string, string>()
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url)
    }
  }

  const groups = new Map<string, CheckoutShopGroup>()

  for (const row of items) {
    const productRecord = row.product
    const shopRecord = row.shop

    if (!productRecord || !shopRecord) {
      // Skip unavailable items for checkout summary (they shouldn't be checked out)
      continue
    }

    const checkoutItem: CheckoutItem = {
      productId: productRecord.id,
      name: productRecord.name,
      slug: productRecord.slug,
      priceCents: productRecord.priceCents,
      quantity: row.item.quantity,
      imageUrl: imageByProduct.get(productRecord.id) ?? null,
    }

    const existing = groups.get(shopRecord.id)
    if (existing) {
      existing.items.push(checkoutItem)
      existing.subtotalCents += productRecord.priceCents * row.item.quantity
    } else {
      groups.set(shopRecord.id, {
        shopId: shopRecord.id,
        shopName: shopRecord.name,
        shopSlug: shopRecord.slug,
        items: [checkoutItem],
        subtotalCents: productRecord.priceCents * row.item.quantity,
        shippingOptions: SHIPPING_OPTIONS,
      })
    }
  }

  const shops = Array.from(groups.values())
  const grandTotalCents = shops.reduce((sum, s) => sum + s.subtotalCents, 0)

  return {
    cartId,
    shops,
    grandTotalCents,
  }
}

/* -------------------------------------------------------------------------- */
/*                              createCheckout                                */
/* -------------------------------------------------------------------------- */

export interface CreateCheckoutResult {
  platformOrderId: string
}

export async function createCheckoutQuery(
  input: CheckoutInput,
  userId: string,
): Promise<CreateCheckoutResult> {
  return db.transaction(async (tx) => {
    // 1. Verify cart ownership
    const [cartRecord] = await tx.select().from(cart).where(eq(cart.id, input.cartId)).limit(1)
    if (!cartRecord || cartRecord.userId !== userId) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Cart not found or access denied' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 2. Fetch cart items with products
    const items = await tx
      .select({
        item: cartItem,
        product: product,
      })
      .from(cartItem)
      .leftJoin(product, eq(cartItem.productId, product.id))
      .where(eq(cartItem.cartId, input.cartId))

    if (items.length === 0) {
      throw new Response(JSON.stringify({ error: 'Conflict', message: 'Cart is empty' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Validate available stock for every product (accounting for reservations)
    const productIds = items.map((r) => r.product?.id).filter((id): id is string => !!id)
    const availableStockMap = await getAvailableStockForProducts(productIds)

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
          productIds: outOfStockProductIds,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // 4. Group items by shop and calculate totals
    const shopGroups = new Map<
      string,
      {
        shopId: string
        items: Array<{ product: typeof product.$inferSelect; quantity: number }>
        subtotalCents: number
      }
    >()

    for (const row of items) {
      if (!row.product) continue
      const existing = shopGroups.get(row.product.shopId)
      if (existing) {
        existing.items.push({ product: row.product, quantity: row.item.quantity })
        existing.subtotalCents += row.product.priceCents * row.item.quantity
      } else {
        shopGroups.set(row.product.shopId, {
          shopId: row.product.shopId,
          items: [{ product: row.product, quantity: row.item.quantity }],
          subtotalCents: row.product.priceCents * row.item.quantity,
        })
      }
    }

    // 5. Validate shipping selections cover all shops
    const shopIds = Array.from(shopGroups.keys())
    const selectionMap = new Map<string, 'standard' | 'express'>()
    for (const sel of input.shippingSelections) {
      selectionMap.set(sel.shopId, sel.method)
    }

    for (const shopId of shopIds) {
      if (!selectionMap.has(shopId)) {
        throw new Response(
          JSON.stringify({
            error: 'Bad Request',
            message: `Missing shipping selection for shop ${shopId}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    // 6. Calculate grand total
    let grandTotalCents = 0
    for (const [, group] of shopGroups) {
      const method = selectionMap.get(group.shopId) ?? 'standard'
      const shippingCost = getShippingCost(method)
      grandTotalCents += group.subtotalCents + shippingCost
    }

    // 7. Create platform order
    const [platformOrderRecord] = await tx
      .insert(platformOrder)
      .values({
        userId,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        totalCents: grandTotalCents,
        status: 'pending_payment',
      })
      .returning()

    // 8. Create shop orders and order items
    for (const [, group] of shopGroups) {
      const method = selectionMap.get(group.shopId) ?? 'standard'
      const shippingCost = getShippingCost(method)

      const [shopOrderRecord] = await tx
        .insert(shopOrder)
        .values({
          platformOrderId: platformOrderRecord.id,
          shopId: group.shopId,
          shippingMethod: method,
          shippingCostCents: shippingCost,
          subtotalCents: group.subtotalCents,
          status: 'pending_payment',
        })
        .returning()

      for (const lineItem of group.items) {
        await tx.insert(orderItem).values({
          shopOrderId: shopOrderRecord.id,
          productId: lineItem.product.id,
          productName: lineItem.product.name,
          unitPriceCents: lineItem.product.priceCents,
          quantity: lineItem.quantity,
          totalCents: lineItem.product.priceCents * lineItem.quantity,
        })
      }
    }

    // 9. Reserve stock for every cart item atomically
    const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    for (const [, group] of shopGroups) {
      for (const lineItem of group.items) {
        try {
          await reserveStockInTx(
            tx,
            lineItem.product.id,
            platformOrderRecord.id,
            lineItem.quantity,
            reservationExpiresAt,
          )
        } catch (err) {
          if (err instanceof InsufficientStockError) {
            throw new Response(
              JSON.stringify({
                error: 'Conflict',
                message: 'Some items are out of stock',
                productIds: [lineItem.product.id],
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            )
          }
          throw err
        }
      }
    }

    // 10. Clear cart and its items
    await tx.delete(cartItem).where(eq(cartItem.cartId, input.cartId))
    await tx.delete(cart).where(eq(cart.id, input.cartId))

    return { platformOrderId: platformOrderRecord.id }
  })
}
