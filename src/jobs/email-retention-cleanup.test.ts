/**
 * Tests for email retention cleanup jobs.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { brevoWebhookEvent, emailOutbox, emailSendLog } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'

import {
  cleanupBrevoWebhookEvents,
  cleanupEmailOutbox,
  cleanupEmailSendLog,
} from '#/lib/email-retention-cleanup.server'

beforeEach(async () => {
  await clearTestTables()
})

async function insertOutbox(
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'suppressed' | 'bounced',
  updatedAt: Date,
): Promise<string> {
  const [row] = await db
    .insert(emailOutbox)
    .values({
      idempotencyKey: `retention-${crypto.randomUUID()}`,
      recipientEmail: 'test@example.com',
      recipientHash: 'hash',
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      status,
      updatedAt,
    })
    .returning({ id: emailOutbox.id })
  return row.id
}

describe('cleanupEmailOutbox', () => {
  it('deletes terminal rows older than 7 days', async () => {
    const oldSent = await insertOutbox('sent', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000))
    const oldFailed = await insertOutbox('failed', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000))
    const recentSent = await insertOutbox('sent', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
    const pending = await insertOutbox('pending', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000))

    const result = await cleanupEmailOutbox(100)
    expect(result.deleted).toBe(2)

    const remaining = await db.select({ id: emailOutbox.id }).from(emailOutbox)
    const ids = remaining.map((r) => r.id).sort()
    expect(ids).toEqual([pending, recentSent].sort())
    expect(ids).not.toContain(oldSent)
    expect(ids).not.toContain(oldFailed)
  })
})

describe('cleanupEmailSendLog', () => {
  it('deletes send log rows older than the retention period', async () => {
    const old = await db
      .insert(emailSendLog)
      .values({
        recipientHash: 'hash',
        template: 'order_confirmation',
        category: 'transactional',
        provider: 'brevo',
        status: 'accepted',
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: emailSendLog.id })
    const recent = await db
      .insert(emailSendLog)
      .values({
        recipientHash: 'hash',
        template: 'order_confirmation',
        category: 'transactional',
        provider: 'brevo',
        status: 'accepted',
        createdAt: new Date(),
      })
      .returning({ id: emailSendLog.id })

    const result = await cleanupEmailSendLog(100)
    expect(result.deleted).toBe(1)

    const remaining = await db.select({ id: emailSendLog.id }).from(emailSendLog)
    expect(remaining.map((r) => r.id)).toEqual([recent[0].id])
    expect(remaining.map((r) => r.id)).not.toContain(old[0].id)
  })
})

describe('cleanupBrevoWebhookEvents', () => {
  it('deletes webhook events older than 30 days', async () => {
    const old = await db
      .insert(brevoWebhookEvent)
      .values({
        payload: {},
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: brevoWebhookEvent.id })
    const recent = await db
      .insert(brevoWebhookEvent)
      .values({
        payload: {},
        createdAt: new Date(),
      })
      .returning({ id: brevoWebhookEvent.id })

    const result = await cleanupBrevoWebhookEvents(100)
    expect(result.deleted).toBe(1)

    const remaining = await db.select({ id: brevoWebhookEvent.id }).from(brevoWebhookEvent)
    expect(remaining.map((r) => r.id)).toEqual([recent[0].id])
    expect(remaining.map((r) => r.id)).not.toContain(old[0].id)
  })
})
