import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { platformOrder } from '#/db/schema'
import { generateOrderNumber } from './numbers'

const MAX_RETRIES = 10

/**
 * Generate an order number and verify uniqueness against the database.
 *
 * Retries up to {@link MAX_RETRIES} times in the extremely unlikely event of
 * collisions. Throws after exhausting retries so the caller can fail loudly
 * rather than silently create a duplicate.
 */
export async function generateUniqueOrderNumber(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = generateOrderNumber()
    const existing = await db
      .select({ id: platformOrder.id })
      .from(platformOrder)
      .where(eq(platformOrder.orderNumber, candidate))
      .limit(1)

    if (existing.length === 0) {
      return candidate
    }
  }

  throw new Error('Unable to generate a unique order number after maximum retries')
}
