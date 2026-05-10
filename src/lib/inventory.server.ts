import { and, eq, gte, sql, sum } from 'drizzle-orm'
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
