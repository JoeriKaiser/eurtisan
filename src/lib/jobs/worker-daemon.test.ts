import { afterEach, describe, expect, it, vi } from 'vitest'
import * as jobLockModule from '#/lib/job-lock.server'
import { startWorkerDaemon } from '#/lib/jobs/worker-daemon.server'
import {
  ALL_BACKGROUND_JOBS,
  filterBackgroundJobs,
  getJobByName,
} from '#/lib/jobs/worker-registry.server'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Worker Registry', () => {
  it('registers all 19 production background jobs', () => {
    expect(ALL_BACKGROUND_JOBS).toHaveLength(19)

    const expectedJobs = [
      'inventory-cleanup',
      'cart-cleanup',
      'session-cleanup',
      'verification-cleanup',
      'audit-log-cleanup',
      'search-event-cleanup',
      'notification-cleanup',
      'notification-digest',
      'email-outbox-worker',
      'email-suppression-cleanup',
      'email-retention-cleanup',
      'financial-totals-reconciliation',
      'meilisearch-sync',
      'mollie-payment-reconciliation',
      'payout-reconciliation',
      'payout-reconciliation-log-cleanup',
      'sendcloud-reconciliation',
      'sendcloud-retention-cleanup',
      'shop-profile-completeness',
    ]

    const registeredNames = ALL_BACKGROUND_JOBS.map((j) => j.name)
    for (const expected of expectedJobs) {
      expect(registeredNames).toContain(expected)
    }
  })

  it('provides a positive interval for every job', () => {
    for (const job of ALL_BACKGROUND_JOBS) {
      const interval = job.getIntervalMs()
      expect(interval).toBeGreaterThan(0)
      expect(typeof job.tick).toBe('function')
    }
  })

  it('looks up jobs by name', () => {
    expect(getJobByName('cart-cleanup')?.name).toBe('cart-cleanup')
    expect(getJobByName('non-existent-job')).toBeUndefined()
  })

  it('filters jobs using only and exclude options', () => {
    const onlyFiltered = filterBackgroundJobs({
      only: ['cart-cleanup', 'session-cleanup'],
    })
    expect(onlyFiltered.map((j) => j.name)).toEqual(['cart-cleanup', 'session-cleanup'])

    const excludeFiltered = filterBackgroundJobs({
      exclude: ['cart-cleanup', 'session-cleanup'],
    })
    expect(excludeFiltered).toHaveLength(17)
    expect(excludeFiltered.some((j) => j.name === 'cart-cleanup')).toBe(false)
  })
})

describe('Worker Daemon', () => {
  it('returns empty stats when no jobs match filter', async () => {
    const result = await startWorkerDaemon({
      only: ['non-existent-job'],
      runOnce: true,
    })

    expect(result.executedJobs).toEqual([])
    expect(result.successCount).toBe(0)
  })

  it('handles immediate abort gracefully in continuous mode', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await startWorkerDaemon({
      only: ['cart-cleanup'],
      signal: controller.signal,
    })

    expect(result.executedJobs).toEqual(['cart-cleanup'])
  })

  it('staggers initial job ticks and aborts cleanly during stagger sleep', async () => {
    const controller = new AbortController()
    const started: string[] = []

    vi.spyOn(jobLockModule, 'withJobLock').mockImplementation(async (jobName) => {
      started.push(jobName)
      return undefined
    })

    setTimeout(() => controller.abort(), 35)

    const result = await startWorkerDaemon({
      only: ['cart-cleanup', 'session-cleanup'],
      initialStaggerMs: 80,
      signal: controller.signal,
    })

    expect(result.executedJobs).toEqual(['cart-cleanup', 'session-cleanup'])
    expect(started).toEqual(['cart-cleanup'])
  })

  it('isolates a failing job tick without crashing sibling job loops', async () => {
    const controller = new AbortController()
    const started: string[] = []

    vi.spyOn(jobLockModule, 'withJobLock').mockImplementation(async (jobName) => {
      started.push(jobName)
      if (jobName === 'cart-cleanup') {
        throw new Error('simulated transient DB timeout')
      }
      if (jobName === 'session-cleanup') {
        controller.abort()
      }
      return undefined
    })

    const result = await startWorkerDaemon({
      only: ['cart-cleanup', 'session-cleanup'],
      initialStaggerMs: 10,
      signal: controller.signal,
    })

    expect(result.executedJobs).toEqual(['cart-cleanup', 'session-cleanup'])
    expect(started).toEqual(['cart-cleanup', 'session-cleanup'])
  })
})
