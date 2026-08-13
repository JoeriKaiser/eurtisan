/**
 * Shop profile completeness sampler.
 *
 * Periodically scores every active shop's public profile against
 * `SHOP_PROFILE_SCORED_FIELDS` and observes the fractions into
 * `eurtisan_shop_profile_completeness`.
 *
 * This exists to answer a question the platform could not previously ask: the
 * creator dashboard has prompted sellers to add a banner, socials, and an
 * announcement for a long time, with no way to tell whether the prompting
 * works. Now that the storefront renders those fields, the histogram shows
 * whether sellers actually fill them in.
 *
 * Configuration (via environment variables):
 *   SHOP_PROFILE_COMPLETENESS_INTERVAL_MS — polling interval (default: 3_600_000)
 *
 * Usage:
 *   bun run src/jobs/shop-profile-completeness.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { shopProfileCompleteness } from '#/lib/metrics.server'
import { getShopProfileCompletenessSamples } from '#/lib/shops/public-profile.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(
  process.env.SHOP_PROFILE_COMPLETENESS_INTERVAL_MS ?? '3600000',
  10,
)

const JOB_NAME = 'shop-profile-completeness'

let isRunning = true

async function tick(): Promise<void> {
  const samples = await getShopProfileCompletenessSamples()

  // Reset before re-observing. A Prometheus histogram accumulates forever, and
  // this job resamples the *same* population every tick — without the reset the
  // buckets would mix today's shops with every previous run's, and the
  // distribution would lag reality further the longer the process lived. What
  // this series means is "the current spread across active shops", so each tick
  // replaces the snapshot rather than adding to it.
  shopProfileCompleteness.reset()
  for (const fraction of samples) {
    shopProfileCompleteness.observe(fraction)
  }

  logger.info(`[shop-profile-completeness] Sampled ${samples.length} active shop(s)`, {
    job: JOB_NAME,
    shopCount: samples.length,
  })
}

async function run(): Promise<void> {
  logger.info(`[shop-profile-completeness] Started (interval=${INTERVAL_MS}ms)`, {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
  })

  // Declares the cadence EurtisanJobStale measures this job against.
  declareJobInterval(JOB_NAME, INTERVAL_MS)

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[shop-profile-completeness] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info(
      '[shop-profile-completeness] Another instance is already running; exiting cleanly.',
      { job: JOB_NAME },
    )
  }
}

main().catch((err) => {
  logger.error('[shop-profile-completeness] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
