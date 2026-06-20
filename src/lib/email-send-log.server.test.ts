/**
 * Tests for the email send log.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { emailSendLog } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'

import {
  findRecentSendLogByRecipientHash,
  findSendLogByProviderMessageId,
  logEmailEvent,
} from './email-send-log.server'
import { sha256Hex } from './hash.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('logEmailEvent', () => {
  it('inserts a send log row', async () => {
    const hash = await sha256Hex('alice@example.com')
    await logEmailEvent({
      recipientHash: hash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      providerMessageId: 'msg-123',
      status: 'accepted',
    })

    const rows = await db.select().from(emailSendLog)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.recipientHash).toBe(hash)
    expect(rows[0]?.provider).toBe('brevo')
    expect(rows[0]?.providerMessageId).toBe('msg-123')
    expect(rows[0]?.status).toBe('accepted')
  })

  it('stores event data and status detail', async () => {
    const hash = await sha256Hex('bob@example.com')
    await logEmailEvent({
      recipientHash: hash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      status: 'bounced',
      statusDetail: 'hard_bounce',
      eventData: { reason: 'invalid' },
    })

    const row = await db
      .select()
      .from(emailSendLog)
      .then((rows) => rows[0])
    expect(row?.statusDetail).toBe('hard_bounce')
    expect(row?.eventData).toEqual({ reason: 'invalid' })
  })
})

describe('findSendLogByProviderMessageId', () => {
  it('finds the most recent row by message id', async () => {
    const hash = await sha256Hex('carol@example.com')
    await logEmailEvent({
      recipientHash: hash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      providerMessageId: 'msg-456',
      status: 'accepted',
    })

    const found = await findSendLogByProviderMessageId('brevo', 'msg-456')
    expect(found).toBeDefined()
    expect(found?.providerMessageId).toBe('msg-456')
  })

  it('returns undefined for unknown message ids', async () => {
    const found = await findSendLogByProviderMessageId('brevo', 'missing')
    expect(found).toBeUndefined()
  })
})

describe('findRecentSendLogByRecipientHash', () => {
  it('finds a recent row by recipient hash', async () => {
    const hash = await sha256Hex('dave@example.com')
    await logEmailEvent({
      recipientHash: hash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      status: 'accepted',
    })

    const found = await findRecentSendLogByRecipientHash(hash, 'brevo')
    expect(found).toBeDefined()
    expect(found?.recipientHash).toBe(hash)
  })

  it('does not find rows older than 7 days', async () => {
    const hash = await sha256Hex('eve@example.com')
    await db.insert(emailSendLog).values({
      recipientHash: hash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      status: 'accepted',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    })

    const found = await findRecentSendLogByRecipientHash(hash, 'brevo')
    expect(found).toBeUndefined()
  })
})
