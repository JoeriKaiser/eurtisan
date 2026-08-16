/**
 * Unified Background Worker Daemon Entrypoint.
 *
 * Runs all configured background jobs in a single process.
 *
 * Usage:
 *   bun run src/jobs/worker-daemon.ts
 *   bun run src/jobs/worker-daemon.ts --only=inventory-cleanup,cart-cleanup
 *   bun run src/jobs/worker-daemon.ts --exclude=financial-totals-reconciliation
 *   bun run src/jobs/worker-daemon.ts --once
 */
import { startWorkerDaemon } from '#/lib/jobs/worker-daemon.server'
import { logger } from '#/lib/logger.server'

function parseArgs(): {
  only?: string[]
  exclude?: string[]
  runOnce?: boolean
} {
  const args = process.argv.slice(2)
  let only: string[] | undefined
  let exclude: string[] | undefined
  let runOnce = false

  for (const arg of args) {
    if (arg === '--once') {
      runOnce = true
    } else if (arg.startsWith('--only=')) {
      only = arg
        .slice(7)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (arg.startsWith('--exclude=')) {
      exclude = arg
        .slice(10)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }

  return { only, exclude, runOnce }
}

const shutdownController = new AbortController()

function handleSignal(signal: string): void {
  logger.info(`[worker-daemon] Received ${signal}; shutting down gracefully...`)
  shutdownController.abort()
}

process.on('SIGINT', () => handleSignal('SIGINT'))
process.on('SIGTERM', () => handleSignal('SIGTERM'))

async function main(): Promise<void> {
  const { only, exclude, runOnce } = parseArgs()

  const result = await startWorkerDaemon({
    only,
    exclude,
    runOnce,
    signal: shutdownController.signal,
  })

  if (runOnce) {
    logger.info('[worker-daemon] One-time execution completed', { ...result })
    if (result.failureCount > 0) {
      process.exitCode = 1
    }
  }
}

if (!process.env.VITEST) {
  main().catch((error) => {
    logger.error('[worker-daemon] Fatal daemon error:', error)
    process.exit(1)
  })
}
