/**
 * Cleanup job for expired email suppressions.
 *
 * Soft-bounce suppressions are retained for a configurable number of days;
 * hard bounces and spam complaints are permanent (`expiresAt IS NULL`).
 */

import { and, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { emailSuppression } from '#/db/schema'

export async function cleanupExpiredSuppressions(batchSize: number): Promise<{ deleted: number }> {
  const subquery = db
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(and(isNotNull(emailSuppression.expiresAt), lte(emailSuppression.expiresAt, sql`now()`)))
    .limit(batchSize)

  const result = await db.delete(emailSuppression).where(inArray(emailSuppression.email, subquery))

  return { deleted: result.rowCount ?? 0 }
}
