/**
 * Tests for the email outbox worker.
 */

import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { emailOutbox, emailSendLog } from '#/db/schema'
import { createUser } from '#/test/factories'
import { clearTestTables } from '#/test/cleanup'

import { enqueueEmail } from '#/lib/email-outbox.server'
import { encrypt } from '#/lib/encryption.server'
import { sha256Hex } from '#/lib/hash.server'

let sendTransactional = vi.fn()
let providerName = 'mock'
let suppressedEmails = new Set<string>()

vi.mock('#/integrations/email', () => ({
  createEmailProvider: vi.fn(() => ({
    get name() {
      return providerName
    },
    sendTransactional: (...args: unknown[]) => sendTransactional(...args),
  })),
}))

vi.mock('#/lib/email-suppression.server', () => ({
  isEmailSuppressed: vi.fn((email: string) => Promise.resolve(suppressedEmails.has(email))),
}))

async function importWorker() {
  return import('./email-outbox-worker')
}

beforeEach(async () => {
  await clearTestTables()
  sendTransactional = vi.fn()
  providerName = 'mock'
  suppressedEmails = new Set()
  vi.stubEnv('EMAIL_MAX_RETRIES', '2')
})

describe('processOutboxBatch', () => {
  it('sends pending rows and marks them as sent', async () => {
    sendTransactional.mockResolvedValue({ messageId: 'msg-1', accepted: true, provider: 'mock' })

    const user = await createUser({ email: 'alice@example.com' })
    await enqueueEmail({
      to: 'alice@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: { orderNumber: '42' },
      category: 'transactional',
      idempotencyKey: 'worker-1',
    })

    const { processOutboxBatch } = await importWorker()
    const processed = await processOutboxBatch(10)

    expect(processed).toBe(1)
    expect(sendTransactional).toHaveBeenCalledTimes(1)
    expect(sendTransactional).toHaveBeenCalledWith(
      'alice@example.com',
      'order_confirmation',
      expect.objectContaining({ orderNumber: '42' }),
      expect.any(Object),
    )

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'worker-1'),
    })
    expect(row?.status).toBe('sent')
    expect(row?.provider).toBe('mock')
    expect(row?.providerMessageId).toBe('msg-1')
    expect(row?.sentAt).toBeInstanceOf(Date)

    const logs = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.outboxId, row?.id ?? ''))
    expect(logs).toHaveLength(1)
    expect(logs[0]?.status).toBe('accepted')
    expect(logs[0]?.providerMessageId).toBe('msg-1')
  })

  it('decrypts guest access tokens only at delivery time', async () => {
    sendTransactional.mockResolvedValue({
      messageId: 'msg-guest',
      accepted: true,
      provider: 'mock',
    })
    const token = 'guest-access-token-that-is-long-enough'
    await enqueueEmail({
      to: 'guest@example.com',
      userId: null,
      template: 'guest_order_access',
      data: { orderNumber: 'GUEST-42', encryptedAccessToken: encrypt(token) },
      category: 'transactional',
      idempotencyKey: 'worker-guest',
    })

    const { processOutboxBatch } = await importWorker()
    await processOutboxBatch(10)

    expect(sendTransactional).toHaveBeenCalledWith(
      'guest@example.com',
      'guest_order_access',
      {
        orderNumber: 'GUEST-42',
        accessUrl: expect.stringContaining(`token=${encodeURIComponent(token)}`),
      },
      expect.any(Object),
    )
  })

  it('skips suppressed recipients and marks the row suppressed', async () => {
    sendTransactional.mockResolvedValue({ messageId: 'msg-2', accepted: true, provider: 'mock' })
    suppressedEmails.add('bounced@example.com')

    const user = await createUser({ email: 'bounced@example.com' })
    await enqueueEmail({
      to: 'bounced@example.com',
      userId: user.id,
      template: 'order_confirmation',
      data: {},
      category: 'transactional',
      idempotencyKey: 'worker-2',
    })

    const { processOutboxBatch } = await importWorker()
    const processed = await processOutboxBatch(10)

    expect(processed).toBe(1)
    expect(sendTransactional).not.toHaveBeenCalled()

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'worker-2'),
    })
    expect(row?.status).toBe('suppressed')

    const logs = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.outboxId, row?.id ?? ''))
    expect(logs).toHaveLength(1)
    expect(logs[0]?.status).toBe('suppressed')
  })

  it('retries transient failures and marks failed after max retries', async () => {
    sendTransactional.mockRejectedValue(new Error('timeout'))

    const user = await createUser({ email: 'carol@example.com' })
    await enqueueEmail({
      to: 'carol@example.com',
      userId: user.id,
      template: 'shipping_notification',
      data: {},
      category: 'transactional',
      idempotencyKey: 'worker-3',
      maxRetries: 2,
    })

    const { processOutboxBatch } = await importWorker()

    // First attempt: pending -> failure, scheduled in the future
    let processed = await processOutboxBatch(10)
    expect(processed).toBe(1)

    let row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'worker-3'),
    })
    expect(row?.status).toBe('pending')
    expect(row?.retryCount).toBe(1)
    expect(row?.failureReason).toBe('timeout')

    // Manually make the row immediately eligible for retry.
    await db
      .update(emailOutbox)
      .set({ nextRetryAt: new Date() })
      .where(eq(emailOutbox.id, row?.id ?? ''))

    // Second attempt: still fails and hits max retries.
    processed = await processOutboxBatch(10)
    expect(processed).toBe(1)

    row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'worker-3'),
    })
    expect(row?.status).toBe('failed')
    expect(row?.retryCount).toBe(2)

    const logs = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.outboxId, row?.id ?? ''))
    expect(logs).toHaveLength(1)
    expect(logs[0]?.status).toBe('failed')
    expect(logs[0]?.statusDetail).toBe('timeout')
  })

  it('does not send opt-out categories disabled by the user', async () => {
    sendTransactional.mockResolvedValue({ messageId: 'msg-4', accepted: true, provider: 'mock' })

    const user = await createUser({ email: 'dave@example.com' })
    await db.insert(emailOutbox).values({
      idempotencyKey: 'worker-4',
      recipientHash: await sha256Hex('dave@example.com'),
      template: 'seller_news',
      data: {},
      category: 'seller_updates',
      status: 'pending',
      userId: user.id,
    })

    const { userEmailPreference } = await import('#/db/schema')
    await db.insert(userEmailPreference).values({
      userId: user.id,
      category: 'seller_updates',
      enabled: false,
    })

    const { processOutboxBatch } = await importWorker()
    const processed = await processOutboxBatch(10)

    expect(processed).toBe(1)
    expect(sendTransactional).not.toHaveBeenCalled()

    const row = await db.query.emailOutbox.findFirst({
      where: eq(emailOutbox.idempotencyKey, 'worker-4'),
    })
    expect(row?.status).toBe('suppressed')
    expect(row?.failureReason).toBe('category disabled')
  })
})
