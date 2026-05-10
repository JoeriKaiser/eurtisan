import { and, eq, gte, lt, sql, sum } from 'drizzle-orm'
import { db } from '#/db/index'
import { inventoryReservation, product } from '#/db/schema'

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
  })
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

    await tx
      .delete(inventoryReservation)
      .where(
        ids.length === 1
          ? eq(inventoryReservation.id, ids[0])
          : sql`${inventoryReservation.id} in ${ids}`,
      )

    return { releasedCount: expired.length }
  })
}
