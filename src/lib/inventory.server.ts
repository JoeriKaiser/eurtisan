import { and, eq, gte, inArray, isNull, lt, ne, or, sql, sum } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db } from '#/db/index'
import type * as schema from '#/db/schema'
import {
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  productVariant,
  shopOrder,
} from '#/db/schema'

type DbOrTx = NodePgDatabase<typeof schema>

export class InsufficientStockError extends Error {
  constructor(
    message: string,
    public readonly availableQuantity: number,
    public readonly requestedQuantity: number,
  ) {
    super(message)
    this.name = 'InsufficientStockError'
  }
}

/**
 * Calculate available stock for a single product, accounting for active
 * reservations.
 *
 * @param excludeCartId Optional cart ID whose reservations should be excluded
 *   from the total (used when updating a cart so its own reservations don't
 *   double-count against available inventory).
 */
export async function getAvailableStock(
  productId: string,
  excludeCartId?: string,
): Promise<number> {
  return _getAvailableStock(db, productId, excludeCartId)
}

export async function getAvailableStockInTx(
  tx: DbOrTx,
  productId: string,
  excludeCartId?: string,
): Promise<number> {
  return _getAvailableStock(tx, productId, excludeCartId)
}

async function _getAvailableStock(
  executor: DbOrTx,
  productId: string,
  excludeCartId?: string,
): Promise<number> {
  const [productRow] = await executor
    .select()
    .from(product)
    .where(eq(product.id, productId))
    .limit(1)

  if (!productRow) return 0

  const [reservationResult] = await executor
    .select({ totalReserved: sum(inventoryReservation.quantity) })
    .from(inventoryReservation)
    .where(
      excludeCartId
        ? and(
            eq(inventoryReservation.productId, productId),
            gte(inventoryReservation.expiresAt, sql`now()`),
            or(isNull(inventoryReservation.cartId), ne(inventoryReservation.cartId, excludeCartId)),
          )
        : and(
            eq(inventoryReservation.productId, productId),
            gte(inventoryReservation.expiresAt, sql`now()`),
          ),
    )

  const totalReserved = Number(reservationResult?.totalReserved ?? 0)
  return Math.max(0, productRow.stockCount - totalReserved)
}

/**
 * Batch calculate available stock for multiple products.
 *
 * @param excludeCartId Optional cart ID whose reservations should be excluded
 *   from the total.
 */
export async function getAvailableStockForProducts(
  productIds: string[],
  excludeCartId?: string,
): Promise<Map<string, number>> {
  return _getAvailableStockForProducts(db, productIds, excludeCartId)
}

export async function getAvailableStockForProductsInTx(
  tx: DbOrTx,
  productIds: string[],
  excludeCartId?: string,
): Promise<Map<string, number>> {
  return _getAvailableStockForProducts(tx, productIds, excludeCartId)
}

async function _getAvailableStockForProducts(
  executor: DbOrTx,
  productIds: string[],
  excludeCartId?: string,
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()

  const [products, reservations] = await Promise.all([
    executor.select().from(product).where(inArray(product.id, productIds)),
    executor
      .select({
        productId: inventoryReservation.productId,
        totalReserved: sum(inventoryReservation.quantity),
      })
      .from(inventoryReservation)
      .where(
        excludeCartId
          ? and(
              inArray(inventoryReservation.productId, productIds),
              gte(inventoryReservation.expiresAt, sql`now()`),
              or(
                isNull(inventoryReservation.cartId),
                ne(inventoryReservation.cartId, excludeCartId),
              ),
            )
          : and(
              inArray(inventoryReservation.productId, productIds),
              gte(inventoryReservation.expiresAt, sql`now()`),
            ),
      )
      .groupBy(inventoryReservation.productId),
  ])

  const reservedMap = new Map<string, number>()
  for (const r of reservations) {
    reservedMap.set(r.productId, Number(r.totalReserved ?? 0))
  }

  const result = new Map<string, number>()
  for (const p of products) {
    const reserved = reservedMap.get(p.id) ?? 0
    result.set(p.id, Math.max(0, p.stockCount - reserved))
  }

  return result
}

async function _reserveStock(
  tx: DbOrTx,
  productId: string,
  platformOrderId: string,
  quantity: number,
  expiresAt: Date,
): Promise<void> {
  // 1. Lock product row to serialize reservations for this product
  const [productRow] = await tx
    .select()
    .from(product)
    .where(eq(product.id, productId))
    .for('update')

  if (!productRow) {
    throw new Error(`Product ${productId} not found`)
  }

  // 2. Sum active reservations for this product
  const [reservationResult] = await tx
    .select({ totalReserved: sum(inventoryReservation.quantity) })
    .from(inventoryReservation)
    .where(
      and(
        eq(inventoryReservation.productId, productId),
        gte(inventoryReservation.expiresAt, sql`now()`),
      ),
    )

  const totalReserved = Number(reservationResult?.totalReserved ?? 0)
  const availableQuantity = productRow.stockCount - totalReserved

  if (quantity > availableQuantity) {
    throw new InsufficientStockError(
      `Requested ${quantity} but only ${availableQuantity} available`,
      availableQuantity,
      quantity,
    )
  }

  // 3. Upsert reservation (unique per product + order)
  const [existing] = await tx
    .select()
    .from(inventoryReservation)
    .where(
      and(
        eq(inventoryReservation.productId, productId),
        eq(inventoryReservation.platformOrderId, platformOrderId),
      ),
    )

  if (existing) {
    await tx
      .update(inventoryReservation)
      .set({ quantity, expiresAt })
      .where(eq(inventoryReservation.id, existing.id))
  } else {
    await tx.insert(inventoryReservation).values({
      productId,
      platformOrderId,
      quantity,
      expiresAt,
    })
  }
}

/**
 * Atomically reserve stock for a product against a platform order.
 *
 * Locks the product row with `FOR UPDATE` to prevent concurrent
 * overselling. Available quantity is calculated as:
 *   product.stockCount − sum(active reservations)
 *
 * If the request exceeds available stock an {@link InsufficientStockError}
 * is thrown carrying the current `availableQuantity`.
 *
 * When a reservation already exists for the same product + order it is
 * updated in place.
 */
export async function reserveStock(
  productId: string,
  platformOrderId: string,
  quantity: number,
  expiresAt: Date,
): Promise<void> {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0')
  }

  return db.transaction(async (tx) => {
    await _reserveStock(tx, productId, platformOrderId, quantity, expiresAt)
  })
}

/**
 * Reserve stock inside an existing transaction.
 */
export async function reserveStockInTx(
  tx: DbOrTx,
  productId: string,
  platformOrderId: string,
  quantity: number,
  expiresAt: Date,
): Promise<void> {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0')
  }
  await _reserveStock(tx, productId, platformOrderId, quantity, expiresAt)
}

/**
 * Release all stock reservations held for a platform order.
 *
 * Deletes every `inventory_reservation` row tied to the order.
 * Safe to call for cancellations or completions.
 */
export async function releaseStock(platformOrderId: string): Promise<void> {
  return db.transaction(async (tx) => {
    await tx
      .delete(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, platformOrderId))
  })
}

/**
 * Release stock reservations inside an existing transaction.
 */
export async function releaseStockInTx(tx: DbOrTx, platformOrderId: string): Promise<void> {
  await tx
    .delete(inventoryReservation)
    .where(eq(inventoryReservation.platformOrderId, platformOrderId))
}

/**
 * Reserve stock for a cart item inside an existing transaction.
 *
 * Locks the product row and checks available stock (excluding the cart's own
 * reservation so quantities can be updated in place). Upserts a reservation
 * row keyed by `(productId, cartId)`.
 */
export async function reserveCartStockInTx(
  tx: DbOrTx,
  cartId: string,
  productId: string,
  quantity: number,
  expiresAt: Date,
): Promise<void> {
  if (quantity <= 0) {
    await tx
      .delete(inventoryReservation)
      .where(
        and(eq(inventoryReservation.cartId, cartId), eq(inventoryReservation.productId, productId)),
      )
    return
  }

  const [productRow] = await tx
    .select()
    .from(product)
    .where(eq(product.id, productId))
    .for('update')

  if (!productRow) {
    throw new Error(`Product ${productId} not found`)
  }

  const [reservationResult] = await tx
    .select({ totalReserved: sum(inventoryReservation.quantity) })
    .from(inventoryReservation)
    .where(
      and(
        eq(inventoryReservation.productId, productId),
        gte(inventoryReservation.expiresAt, sql`now()`),
        // Exclude this cart's own reservation so we don't double-count
        // when updating quantity.
        or(isNull(inventoryReservation.cartId), ne(inventoryReservation.cartId, cartId)),
      ),
    )

  const totalReserved = Number(reservationResult?.totalReserved ?? 0)
  const availableQuantity = productRow.stockCount - totalReserved

  if (quantity > availableQuantity) {
    throw new InsufficientStockError(
      `Requested ${quantity} but only ${availableQuantity} available`,
      availableQuantity,
      quantity,
    )
  }

  const [existing] = await tx
    .select()
    .from(inventoryReservation)
    .where(
      and(eq(inventoryReservation.cartId, cartId), eq(inventoryReservation.productId, productId)),
    )

  if (existing) {
    await tx
      .update(inventoryReservation)
      .set({ quantity, expiresAt })
      .where(eq(inventoryReservation.id, existing.id))
  } else {
    await tx.insert(inventoryReservation).values({
      cartId,
      productId,
      quantity,
      expiresAt,
    })
  }
}

/**
 * Release all cart stock reservations for a given cart (optionally scoped to a
 * single product).
 */
export async function releaseCartStockInTx(
  tx: DbOrTx,
  cartId: string,
  productId?: string,
): Promise<void> {
  if (productId) {
    await tx
      .delete(inventoryReservation)
      .where(
        and(eq(inventoryReservation.cartId, cartId), eq(inventoryReservation.productId, productId)),
      )
  } else {
    await tx.delete(inventoryReservation).where(eq(inventoryReservation.cartId, cartId))
  }
}

export interface ReleaseExpiredResult {
  releasedCount: number
}

/**
 * Find and delete all inventory reservations whose `expiresAt` is in the past.
 *
 * This is idempotent: running it multiple times in a row simply finds zero
 * remaining expired rows after the first successful call.
 *
 * Because the available inventory for a product is computed as
 * `product.stockCount − sum(active reservations)`, deleting expired
 * reservations automatically restores the held stock to the available pool.
 *
 * Products deleted since the reservation was created are handled gracefully
 * by the foreign-key `ON DELETE CASCADE`; any remaining orphaned rows are
 * still removed safely.
 */
export async function releaseExpiredReservations(batchSize = 100): Promise<ReleaseExpiredResult> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: inventoryReservation.id })
      .from(inventoryReservation)
      .where(lt(inventoryReservation.expiresAt, sql`now()`))
      .limit(batchSize)

    if (expired.length === 0) {
      return { releasedCount: 0 }
    }

    const ids = expired.map((r) => r.id)

    await tx.delete(inventoryReservation).where(inArray(inventoryReservation.id, ids))

    return { releasedCount: expired.length }
  })
}

export interface CancelAbandonedOrdersResult {
  cancelledCount: number
}

/**
 * Cancel platform orders stuck in `pending_payment` for more than 30 minutes.
 *
 * For every matching order:
 * - Updates the `platform_order` status to `cancelled` and records metadata.
 * - Updates related `shop_order` rows to `cancelled`.
 * - Deletes `inventory_reservation` rows to release held stock.
 *
 * This is idempotent: running it multiple times in a row simply finds zero
 * remaining abandoned orders after the first successful call.
 */
export async function cancelAbandonedPendingPaymentOrders(
  batchSize = 100,
): Promise<CancelAbandonedOrdersResult> {
  return db.transaction(async (tx) => {
    const abandoned = await tx
      .select({ id: platformOrder.id })
      .from(platformOrder)
      .where(
        and(
          eq(platformOrder.status, 'pending_payment'),
          lt(platformOrder.createdAt, sql`now() - interval '30 minutes'`),
        ),
      )
      .limit(batchSize)

    if (abandoned.length === 0) {
      return { cancelledCount: 0 }
    }

    const ids = abandoned.map((o) => o.id)
    const now = new Date()

    await tx
      .update(platformOrder)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: 'Abandoned: payment not received within 30 minutes',
      })
      .where(inArray(platformOrder.id, ids))

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled' })
      .where(inArray(shopOrder.platformOrderId, ids))

    await tx.delete(inventoryReservation).where(inArray(inventoryReservation.platformOrderId, ids))

    return { cancelledCount: abandoned.length }
  })
}

/**
 * Atomically commit reserved stock to actual inventory when a platform order
 * is paid.
 *
 * For every order item belonging to the platform order:
 * - If a `variantId` is present, the variant's `stockCount` is decremented.
 * - Otherwise, the product's `stockCount` is decremented.
 *
 * Stock is clamped to zero so it never goes negative. After decrementing,
 * every `inventory_reservation` row tied to the platform order is deleted.
 */
export async function decrementStockForPaidOrder(
  tx: DbOrTx,
  platformOrderId: string,
): Promise<void> {
  const items = await tx
    .select({
      productId: orderItem.productId,
      variantId: orderItem.variantId,
      quantity: orderItem.quantity,
    })
    .from(orderItem)
    .innerJoin(shopOrder, eq(orderItem.shopOrderId, shopOrder.id))
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  // Aggregate quantities per product / variant to minimise row updates.
  const aggregates = new Map<
    string,
    { productId: string; variantId: string | null; quantity: number }
  >()

  for (const item of items) {
    const key = `${item.productId}:${item.variantId ?? ''}`
    const existing = aggregates.get(key)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      aggregates.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })
    }
  }

  for (const entry of aggregates.values()) {
    if (entry.variantId) {
      const [variantRow] = await tx
        .select()
        .from(productVariant)
        .where(eq(productVariant.id, entry.variantId))
        .for('update')

      if (!variantRow) {
        throw new Error(`Product variant ${entry.variantId} not found`)
      }

      const newStock = Math.max(0, variantRow.stockCount - entry.quantity)
      await tx
        .update(productVariant)
        .set({ stockCount: newStock, updatedAt: new Date() })
        .where(eq(productVariant.id, entry.variantId))
    } else {
      const [productRow] = await tx
        .select()
        .from(product)
        .where(eq(product.id, entry.productId))
        .for('update')

      if (!productRow) {
        throw new Error(`Product ${entry.productId} not found`)
      }

      const newStock = Math.max(0, productRow.stockCount - entry.quantity)
      await tx
        .update(product)
        .set({ stockCount: newStock, updatedAt: new Date() })
        .where(eq(product.id, entry.productId))
    }
  }

  await tx
    .delete(inventoryReservation)
    .where(eq(inventoryReservation.platformOrderId, platformOrderId))
}
