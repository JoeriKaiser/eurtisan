import { and, eq, gte, inArray, lt, sql, sum } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db } from '#/db/index'
import type * as schema from '#/db/schema'
import { inventoryReservation, product } from '#/db/schema'

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
 */
export async function getAvailableStock(productId: string): Promise<number> {
  const [productRow] = await db.select().from(product).where(eq(product.id, productId)).limit(1)

  if (!productRow) return 0

  const [reservationResult] = await db
    .select({ totalReserved: sum(inventoryReservation.quantity) })
    .from(inventoryReservation)
    .where(
      and(
        eq(inventoryReservation.productId, productId),
        gte(inventoryReservation.expiresAt, sql`now()`),
      ),
    )

  const totalReserved = Number(reservationResult?.totalReserved ?? 0)
  return Math.max(0, productRow.stockCount - totalReserved)
}

/**
 * Batch calculate available stock for multiple products.
 */
export async function getAvailableStockForProducts(
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()

  const products = await db.select().from(product).where(inArray(product.id, productIds))

  const reservations = await db
    .select({
      productId: inventoryReservation.productId,
      totalReserved: sum(inventoryReservation.quantity),
    })
    .from(inventoryReservation)
    .where(
      and(
        inArray(inventoryReservation.productId, productIds),
        gte(inventoryReservation.expiresAt, sql`now()`),
      ),
    )
    .groupBy(inventoryReservation.productId)

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
