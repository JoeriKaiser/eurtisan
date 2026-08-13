/**
 * Schedules async work after the current request handler returns.
 *
 * Use for notifications, emails, and other side effects that must not block
 * HTTP responses. Failures are logged with `alert: true` for log aggregation.
 */

import { logger } from '../logger.server'

/** Tracks in-flight work when running under Vitest so tests can await side effects. */
const pendingTestWork: Promise<void>[] = []

export function scheduleBackgroundWork(
  label: string,
  work: () => Promise<void>,
  meta?: Record<string, unknown>,
): void {
  const run = Promise.resolve()
    .then(work)
    .catch((err) => {
      logger.error(`Background work failed: ${label}`, err, {
        alert: true,
        ...meta,
      })
    })

  if (process.env.VITEST) {
    pendingTestWork.push(run)
  } else {
    void run
  }
}

/** Await scheduled background work in integration tests (no-op outside Vitest). */
export async function flushBackgroundWorkForTests(): Promise<void> {
  while (pendingTestWork.length > 0) {
    const batch = pendingTestWork.splice(0)
    await Promise.all(batch)
  }
}
