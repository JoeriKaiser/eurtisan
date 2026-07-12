/**
 * Lightweight PostgreSQL advisory-lock helper for background jobs.
 *
 * Ensures only one instance of a given job runs at a time across containers.
 * The lock is held for the lifetime of the provided callback; releasing it is
 * handled automatically, even if the callback throws.
 *
 * If the lock cannot be acquired, the helper returns `undefined` so the caller
 * can exit cleanly without raising an alert.
 */
import { Client } from 'pg'

import { buildPoolConfig } from './db-pool-config'

const LOCK_IDS: Record<string, number> = {
  'inventory-cleanup': 1001,
  'session-cleanup': 1002,
  'cart-cleanup': 1003,
  'meilisearch-sync': 1004,
  'audit-log-cleanup': 1005,
  'verification-cleanup': 1006,
  'payout-reconciliation': 1007,
  'sendcloud-reconciliation': 1008,
  'email-outbox-worker': 1009,
  'email-suppression-cleanup': 1010,
  'email-retention-cleanup': 1011,
  'sendcloud-retention-cleanup': 1012,
  'payout-reconciliation-log-cleanup': 1013,
  'mollie-payment-reconciliation': 1014,
}

export type JobName = keyof typeof LOCK_IDS

/**
 * Run `fn` while holding a session-level PostgreSQL advisory lock for `jobName`.
 *
 * Returns the result of `fn` when the lock is acquired, or `undefined` when
 * another instance already holds the lock. The lock is always released (and the
 * dedicated client connection closed) on return or throw.
 */
export async function withJobLock<T>(
  jobName: JobName,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const lockId = LOCK_IDS[jobName]
  if (lockId === undefined) {
    throw new Error(`Unknown job name: ${jobName}`)
  }

  const config = buildPoolConfig(process.env)
  const client = new Client(config)
  let acquired = false

  try {
    await client.connect()
    const { rows } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [lockId],
    )
    acquired = rows[0]?.locked ?? false

    if (!acquired) {
      return undefined
    }

    return await fn()
  } finally {
    if (acquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [lockId])
      } catch {
        // Best-effort unlock; the session will be closed next.
      }
    }
    await client.end().catch(() => {
      // Ignore close errors.
    })
  }
}
