import { inArray, lt, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { verification } from '#/db/schema'

export interface CleanupExpiredVerificationsResult {
  deletedCount: number
}

/**
 * Find and delete all verification rows whose `expiresAt` is in the past.
 *
 * This is idempotent: running it multiple times in a row simply finds zero
 * remaining expired rows after the first successful call.
 */
export async function cleanupExpiredVerifications(
  batchSize = 100,
): Promise<CleanupExpiredVerificationsResult> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: verification.id })
      .from(verification)
      .where(lt(verification.expiresAt, sql`now()`))
      .limit(batchSize)

    if (expired.length === 0) {
      return { deletedCount: 0 }
    }

    const ids = expired.map((r) => r.id)

    await tx.delete(verification).where(inArray(verification.id, ids))

    return { deletedCount: expired.length }
  })
}
