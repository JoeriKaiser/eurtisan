/**
 * Tests for the Brevo webhook endpoint.
 */

import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { brevoWebhookEvent, emailSendLog, emailSuppression } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'

import { processBrevoWebhook } from './brevo'

const WEBHOOK_TOKEN = 'a'.repeat(64)

function makeRequest(payload: unknown, options?: { token?: string; header?: string }): Request {
  const url = options?.token
    ? `http://localhost/api/webhooks/brevo?token=${options.token}`
    : 'http://localhost/api/webhooks/brevo'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options?.header) {
    headers.Authorization = `Bearer ${options.header}`
  }
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
}

beforeEach(async () => {
  await clearTestTables()
  vi.unstubAllEnvs()
})

describe('authentication', () => {
  it('rejects requests without a token in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    const response = await processBrevoWebhook(
      makeRequest({ event: 'delivered', email: 'a@b.com' }),
    )
    expect(response.status).toBe(401)
  })

  it('rejects query-string tokens in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    const response = await processBrevoWebhook(
      makeRequest({ event: 'delivered', email: 'a@b.com' }, { token: WEBHOOK_TOKEN }),
    )
    expect(response.status).toBe(401)
  })

  it('accepts bearer tokens in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    const response = await processBrevoWebhook(
      makeRequest({ event: 'delivered', email: 'a@b.com' }, { header: WEBHOOK_TOKEN }),
    )
    expect(response.status).toBe(200)
  })

  it('accepts x-brevo-token header in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    const request = new Request('http://localhost/api/webhooks/brevo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Brevo-Token': WEBHOOK_TOKEN,
      },
      body: JSON.stringify({ event: 'delivered', email: 'a@b.com' }),
    })

    const response = await processBrevoWebhook(request)
    expect(response.status).toBe(200)
  })
})

describe('event persistence', () => {
  it('persists the raw event before processing', async () => {
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    const payload = { event: 'delivered', email: 'a@b.com', 'message-id': 'msg-1' }
    await processBrevoWebhook(makeRequest(payload, { header: WEBHOOK_TOKEN }))

    const events = await db.select().from(brevoWebhookEvent)
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toEqual(payload)
    expect(events[0]?.processedAt).toBeInstanceOf(Date)
  })
})

describe('bounce handling', () => {
  it('suppresses hard bounces permanently', async () => {
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    await processBrevoWebhook(
      makeRequest({ event: 'hard_bounce', email: 'bad@example.com' }, { header: WEBHOOK_TOKEN }),
    )

    const row = await db.query.emailSuppression.findFirst({
      where: eq(emailSuppression.email, 'bad@example.com'),
    })
    expect(row?.reason).toBe('hard_bounce')
    expect(row?.expiresAt).toBeNull()
  })

  it('suppresses spam complaints permanently', async () => {
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    await processBrevoWebhook(
      makeRequest({ event: 'spam', email: 'spammer@example.com' }, { header: WEBHOOK_TOKEN }),
    )

    const row = await db.query.emailSuppression.findFirst({
      where: eq(emailSuppression.email, 'spammer@example.com'),
    })
    expect(row?.reason).toBe('spam')
    expect(row?.expiresAt).toBeNull()
  })

  it('does not suppress soft bounces immediately', async () => {
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    await processBrevoWebhook(
      makeRequest({ event: 'soft_bounce', email: 'soft@example.com' }, { header: WEBHOOK_TOKEN }),
    )

    const row = await db.query.emailSuppression.findFirst({
      where: eq(emailSuppression.email, 'soft@example.com'),
    })
    expect(row).toBeUndefined()
  })
})

describe('send log updates', () => {
  it('updates the matching send log row to delivered', async () => {
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', WEBHOOK_TOKEN)

    const { sha256Hex } = await import('#/lib/hash.server')
    const recipientHash = await sha256Hex('buyer@example.com')
    const [log] = await db
      .insert(emailSendLog)
      .values({
        recipientHash,
        template: 'order_confirmation',
        category: 'transactional',
        provider: 'brevo',
        providerMessageId: 'msg-delivered',
        status: 'accepted',
      })
      .returning({ id: emailSendLog.id })

    await processBrevoWebhook(
      makeRequest(
        { event: 'delivered', email: 'buyer@example.com', 'message-id': 'msg-delivered' },
        { header: WEBHOOK_TOKEN },
      ),
    )

    const updated = await db.query.emailSendLog.findFirst({ where: eq(emailSendLog.id, log.id) })
    expect(updated?.status).toBe('delivered')
  })
})
