/**
 * Meilisearch Sync Poller.
 *
 * Runs continuously in the background, periodically processing pending/failed items in the outbox queue.
 *
 * Configuration (via environment variables):
 *   MEILISEARCH_SYNC_INTERVAL_MS — polling interval in milliseconds (default: 5000)
 *   MEILISEARCH_SYNC_BATCH_SIZE  — max rows to process per tick (default: 50)
 *
 * Usage:
 *   bun run src/jobs/meilisearch-sync.ts
 */
import { processMeilisearchSyncQueue } from '#/lib/meilisearch-products.server'

const INTERVAL_MS = Number.parseInt(process.env.MEILISEARCH_SYNC_INTERVAL_MS ?? '5000', 10)
const BATCH_SIZE = Number.parseInt(process.env.MEILISEARCH_SYNC_BATCH_SIZE ?? '50', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await processMeilisearchSyncQueue(BATCH_SIZE)
    if (result.processedCount > 0) {
      console.log(`[meilisearch-sync] Processed ${result.processedCount} sync queue items`)
    }
  } catch (err) {
    console.error('[meilisearch-sync] Error processing sync queue:', err)
  }
}

async function main(): Promise<void> {
  console.log(`[meilisearch-sync] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`)

  await tick()

  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    if (!isRunning) break
    await tick()
  }

  console.log('[meilisearch-sync] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[meilisearch-sync] Fatal error:', err)
  process.exit(1)
})
