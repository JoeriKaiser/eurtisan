import { inArray, lt, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { session } from '#/db/schema'

export interface CleanupExpiredSessionsResult {
  deletedCount: number
}

/**
 * Find and delete all session rows whose `expiresAt` is in the past.
 *
 * This is idempotent: running it multiple times in a row simply finds zero
 * remaining expired rows after the first successful call.
 */
export async function cleanupExpiredSessions(
  batchSize = 100,
): Promise<CleanupExpiredSessionsResult> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: session.id })
      .from(session)
      .where(lt(session.expiresAt, sql`now()`))
      .limit(batchSize)

    if (expired.length === 0) {
      return { deletedCount: 0 }
    }

    const ids = expired.map((r) => r.id)

    await tx.delete(session).where(inArray(session.id, ids))

    return { deletedCount: expired.length }
  })
}
