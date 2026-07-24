/**
 * Tests for the durable email outbox.
 */

import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { emailOutbox } from '#/db/schema'
import { createUser } from '#/test/factories'
import { clearTestTables } from '#/test/cleanup'

import {
  deletePendingOutboxRowsForUser,
  enqueueEmail,
  getPendingOutboxBatch,
  markOutboxFailed,
  markOutboxMaxRetriesReached,
  markOutboxSending,
  markOutboxSent,
  markOutboxSuppressed,
} from './outbox.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('enqueueEmail', () => {
  it('inserts a pending outbox row', async () => {
    const user = await createUser({ email: 'alice@example.com' })
    const result = await enqueueEmail({
      to: 'alice@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: { orderNumber: '42' },
      category: 'transactional',
      idempotencyKey: 'order:42:confirmation',
    })

    expect(result.alreadyExists).toBe(false)

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.id, result.id),
    })
    expect(row).toBeDefined()
    expect(row?.status).toBe('pending')
    expect(row?.recipientHash).toMatch(/^[a-f0-9]{64}$/)
    expect(row?.template).toBe('order_confirmation')
    expect(row?.category).toBe('transactional')
    expect(row?.idempotencyKey).toBe('order:42:confirmation')
  })

  it('does not store a plaintext email address', async () => {
    const user = await createUser({ email: ' plaintext@example.com ' })
    await enqueueEmail({
      to: 'PlainText@Example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'no-plaintext',
    })

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'no-plaintext'),
    })
    expect(row).toBeDefined()
    if (!row) throw new Error('row not found')
    expect(row.recipientEmail).not.toContain('plaintext@example.com')
    expect(
      await import('../encryption.server').then((module) =>
        module.decrypt(row.recipientEmail ?? ''),
      ),
    ).toBe('plaintext@example.com')
    expect(row.recipientHash).toBe(
      await import('../hash.server').then((m) => m.sha256Hex('plaintext@example.com')),
    )
  })

  it('normalizes email before hashing', async () => {
    const user = await createUser({ email: 'Alice@Example.com' })
    await enqueueEmail({
      to: '  ALICE@EXAMPLE.COM  ',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'key-1',
    })

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'key-1'),
    })
    expect(row?.recipientHash).toBe(
      await import('../hash.server').then((m) => m.sha256Hex('alice@example.com')),
    )
  })

  it('returns alreadyExists=true on idempotency key collision without inserting duplicate', async () => {
    const user = await createUser({ email: 'bob@example.com' })
    const first = await enqueueEmail({
      to: 'bob@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: { orderNumber: '1' },
      category: 'transactional',
      idempotencyKey: 'dup-key',
    })

    const second = await enqueueEmail({
      to: 'bob.different@example.com',
      userId: user.id,
      template: 'shipping_notification',
      data: { orderNumber: '2' },
      category: 'transactional',
      idempotencyKey: 'dup-key',
    })

    expect(second.alreadyExists).toBe(true)
    expect(second.id).toBe(first.id)

    const rows = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, 'dup-key'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.template).toBe('order_confirmation')
  })
})

describe('getPendingOutboxBatch', () => {
  it('returns rows scheduled in the past', async () => {
    const user = await createUser({ email: 'carol@example.com' })
    await enqueueEmail({
      to: 'carol@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'batch-1',
      scheduledAt: new Date(Date.now() - 1000),
    })

    const batch = await getPendingOutboxBatch(10)
    expect(batch).toHaveLength(1)
    expect(batch[0]?.idempotencyKey).toBe('batch-1')
  })

  it('skips rows with future nextRetryAt', async () => {
    const user = await createUser({ email: 'dave@example.com' })
    await enqueueEmail({
      to: 'dave@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'batch-2',
    })
    const { id } = await enqueueEmail({
      to: 'dave@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'batch-2',
    })
    await markOutboxFailed(id, 'transient', new Date(Date.now() + 60_000))

    const batch = await getPendingOutboxBatch(10)
    expect(batch).toHaveLength(0)
  })

  it('respects the limit', async () => {
    const user = await createUser({ email: 'eve@example.com' })
    for (let i = 0; i < 5; i++) {
      await enqueueEmail({
        to: 'eve@example.com',
        userId: user.id,
        template: 'order_confirmation',
        data: {},
        category: 'transactional',
        idempotencyKey: `limit-${i}`,
      })
    }

    const batch = await getPendingOutboxBatch(2)
    expect(batch).toHaveLength(2)
  })
})

describe('status transitions', () => {
  it('marks a row as sending', async () => {
    const user = await createUser({ email: 'frank@example.com' })
    const { id } = await enqueueEmail({
      to: 'frank@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'transition-1',
    })

    await markOutboxSending(id)
    const row = await db.query.emailOutbox.findFirst({ where: eq(emailOutbox.id, id) })
    expect(row?.status).toBe('sending')
  })

  it('marks a row as sent', async () => {
    const user = await createUser({ email: 'grace@example.com' })
    const { id } = await enqueueEmail({
      to: 'grace@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'transition-2',
    })

    await markOutboxSent(id, 'brevo', 'msg-123')
    const row = await db.query.emailOutbox.findFirst({ where: eq(emailOutbox.id, id) })
    expect(row?.status).toBe('sent')
    expect(row?.provider).toBe('brevo')
    expect(row?.providerMessageId).toBe('msg-123')
    expect(row?.sentAt).toBeInstanceOf(Date)
  })

  it('marks a row as failed with retry info', async () => {
    const user = await createUser({ email: 'henry@example.com' })
    const { id } = await enqueueEmail({
      to: 'henry@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'transition-3',
    })

    const nextRetryAt = new Date(Date.now() + 60_000)
    await markOutboxFailed(id, 'timeout', nextRetryAt)
    const row = await db.query.emailOutbox.findFirst({ where: eq(emailOutbox.id, id) })
    expect(row?.status).toBe('pending')
    expect(row?.failureReason).toBe('timeout')
    expect(row?.nextRetryAt?.getTime()).toBe(nextRetryAt.getTime())
  })

  it('marks a row as suppressed', async () => {
    const user = await createUser({ email: 'ivy@example.com' })
    const { id } = await enqueueEmail({
      to: 'ivy@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'transition-4',
    })

    await markOutboxSuppressed(id, 'category disabled')
    const row = await db.query.emailOutbox.findFirst({ where: eq(emailOutbox.id, id) })
    expect(row?.status).toBe('suppressed')
    expect(row?.failureReason).toBe('category disabled')
  })

  it('marks a row as failed permanently after max retries', async () => {
    const user = await createUser({ email: 'jack@example.com' })
    const { id } = await enqueueEmail({
      to: 'jack@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'transition-5',
    })

    await markOutboxMaxRetriesReached(id, 'permanent failure', 3)
    const row = await db.query.emailOutbox.findFirst({ where: eq(emailOutbox.id, id) })
    expect(row?.status).toBe('failed')
    expect(row?.failureReason).toBe('permanent failure')
    expect(row?.retryCount).toBe(3)
  })
})

describe('deletePendingOutboxRowsForUser', () => {
  it('removes only pending rows for the user', async () => {
    const user = await createUser({ email: 'kate@example.com' })
    const other = await createUser({ email: 'leo@example.com' })

    const { id: pendingId } = await enqueueEmail({
      to: 'kate@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'cleanup-1',
    })
    const { id: sentId } = await enqueueEmail({
      to: 'kate@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'cleanup-2',
    })
    await markOutboxSent(sentId, 'brevo', 'msg-1')
    await enqueueEmail({
      to: 'leo@example.com',
      userId: other.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'cleanup-3',
    })

    const result = await deletePendingOutboxRowsForUser(user.id)
    expect(result.deleted).toBe(1)

    const remaining = await db.select().from(emailOutbox)
    expect(remaining.map((r) => r.idempotencyKey).sort()).toEqual(['cleanup-2', 'cleanup-3'])
    expect(remaining.find((r) => r.id === pendingId)).toBeUndefined()
  })
})
