/**
 * Tests for Sendcloud webhook event retention cleanup.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { sendcloudWebhookEvent } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createSendcloudWebhookEvent } from '#/test/factories'

import { cleanupSendcloudWebhookEvents } from '#/lib/sendcloud-retention-cleanup.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('cleanupSendcloudWebhookEvents', () => {
  it('deletes webhook events older than the retention period', async () => {
    const old = await createSendcloudWebhookEvent({
      payload: { parcel: { id: '123' } },
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    })
    const recent = await createSendcloudWebhookEvent({
      payload: { parcel: { id: '456' } },
      createdAt: new Date(),
    })

    const result = await cleanupSendcloudWebhookEvents(100)
    expect(result.deleted).toBe(1)

    const remaining = await db.select({ id: sendcloudWebhookEvent.id }).from(sendcloudWebhookEvent)
    expect(remaining.map((r) => r.id)).toEqual([recent.id])
    expect(remaining.map((r) => r.id)).not.toContain(old.id)
  })

  it('does not delete events newer than the retention period', async () => {
    const event = await createSendcloudWebhookEvent({
      payload: { parcel: { id: '789' } },
      createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
    })

    const result = await cleanupSendcloudWebhookEvents(100)
    expect(result.deleted).toBe(0)

    const remaining = await db.select({ id: sendcloudWebhookEvent.id }).from(sendcloudWebhookEvent)
    expect(remaining.map((r) => r.id)).toEqual([event.id])
  })
})
