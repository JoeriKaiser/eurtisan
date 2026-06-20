/**
 * Brevo transactional webhook — POST /api/webhooks/brevo
 *
 * Ingests delivery events (bounces, complaints, deliveries) and updates the
 * send log. Configure Brevo to POST here with an `Authorization: Bearer <token>`
 * header where `<token>` matches `BREVO_WEBHOOK_TOKEN`.
 */

import { timingSafeEqual } from 'node:crypto'

import { createFileRoute } from '@tanstack/react-router'
import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { brevoWebhookEvent, emailSendLog } from '#/db/schema'
import { getBrevoWebhookToken } from '#/lib/env.server'
import { sha256Hex } from '#/lib/hash.server'
import { logger } from '#/lib/logger.server'
import {
  emailBouncedTotal,
  emailComplainedTotal,
  emailDeliveredTotal,
  webhookProcessedTotal,
} from '#/lib/metrics.server'
import { suppressEmail } from '#/lib/email-suppression.server'
import {
  findRecentSendLogByRecipientHash,
  findSendLogByProviderMessageId,
  logEmailEvent,
} from '#/lib/email-send-log.server'
import { getEmailSuppressionSoftBounceRetentionDays } from '#/lib/env.server'

export interface BrevoWebhookEvent {
  event?: string
  email?: string
  reason?: string
  'message-id'?: string
  messageId?: string
  [key: string]: unknown
}

const HARD_BOUNCE_EVENTS = new Set(['hard_bounce', 'hardBounce', 'invalid_email', 'invalid'])
const SOFT_BOUNCE_EVENTS = new Set(['soft_bounce', 'softBounce'])
const SPAM_EVENTS = new Set(['spam', 'complaint', 'blocked'])
const DELIVERY_EVENTS = new Set(['delivered', 'deliverable'])

function mapEventToReason(
  event: string,
): 'hard_bounce' | 'soft_bounce' | 'spam' | 'blocked' | null {
  const normalized = event.trim().toLowerCase()
  if (HARD_BOUNCE_EVENTS.has(normalized) || HARD_BOUNCE_EVENTS.has(event)) {
    return 'hard_bounce'
  }
  if (SPAM_EVENTS.has(normalized) || SPAM_EVENTS.has(event)) {
    return 'spam'
  }
  if (SOFT_BOUNCE_EVENTS.has(normalized) || SOFT_BOUNCE_EVENTS.has(event)) {
    return 'soft_bounce'
  }
  if (normalized === 'blocked') return 'blocked'
  return null
}

function isHardBounceReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase()
  return normalized === 'hard_bounce' || normalized === 'invalid_email' || normalized === 'invalid'
}

function extractBearerToken(request: Request): string | undefined {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice('bearer '.length).trim()
  }

  const customToken = request.headers.get('x-brevo-token')
  if (customToken) {
    return customToken.trim()
  }

  return undefined
}

function extractQueryToken(request: Request): string | undefined {
  const url = new URL(request.url)
  return url.searchParams.get('token')?.trim() ?? undefined
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  try {
    return timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

function verifyWebhookToken(request: Request): boolean {
  const expected = getBrevoWebhookToken()
  if (!expected) {
    // Dev/staging without token: allow (Brevo webhooks are production-only).
    return process.env.NODE_ENV !== 'production'
  }

  const bearer = extractBearerToken(request)
  if (bearer) {
    return safeEqual(bearer, expected)
  }

  // In production, reject tokens carried only in the query string.
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  const queryToken = extractQueryToken(request)
  if (queryToken) {
    return safeEqual(queryToken, expected)
  }

  return false
}

function normalizeEventName(event: string): string {
  return event.trim().toLowerCase()
}

async function recordWebhookEvent(request: Request, payload: unknown): Promise<string | undefined> {
  try {
    const signatureHeader =
      request.headers.get('authorization') ?? request.headers.get('x-brevo-token') ?? null
    const [row] = await db
      .insert(brevoWebhookEvent)
      .values({
        payload: payload as Record<string, unknown>,
        signatureHeader,
      })
      .returning({ id: brevoWebhookEvent.id })
    return row?.id
  } catch (err) {
    logger.error('[BrevoWebhook] Failed to persist raw event', err)
    return undefined
  }
}

async function markEventProcessed(
  eventId: string | undefined,
  error: string | null = null,
): Promise<void> {
  if (!eventId) return
  try {
    await db
      .update(brevoWebhookEvent)
      .set({ processedAt: new Date(), error })
      .where(sql`${brevoWebhookEvent.id} = ${eventId}`)
  } catch (err) {
    logger.error('[BrevoWebhook] Failed to mark event processed', err, { eventId })
  }
}

async function findMatchingLogRow(
  event: BrevoWebhookEvent,
  recipientHash: string,
): Promise<typeof emailSendLog.$inferSelect | undefined> {
  const messageId = event.messageId ?? event['message-id']
  if (messageId) {
    const byId = await findSendLogByProviderMessageId('brevo', messageId)
    if (byId) return byId
  }
  return findRecentSendLogByRecipientHash(recipientHash, 'brevo')
}

async function countRecentSoftBounces(recipientHash: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [result] = await db
    .select({ count: count() })
    .from(emailSendLog)
    .where(
      and(
        eq(emailSendLog.recipientHash, recipientHash),
        eq(emailSendLog.provider, 'brevo'),
        eq(emailSendLog.status, 'bounced'),
        eq(emailSendLog.statusDetail, 'soft_bounce'),
        gte(emailSendLog.createdAt, thirtyDaysAgo),
        lte(emailSendLog.createdAt, sql`now()`),
      ),
    )

  return Number(result?.count ?? 0)
}

async function handleBounce(
  event: BrevoWebhookEvent,
  email: string,
  recipientHash: string,
  reason: 'hard_bounce' | 'soft_bounce' | 'blocked',
): Promise<void> {
  const normalizedReason = reason
  const logRow = await findMatchingLogRow(event, recipientHash)

  if (logRow) {
    await db
      .update(emailSendLog)
      .set({
        status: 'bounced',
        statusDetail: normalizedReason,
        eventData: event as Record<string, unknown>,
      })
      .where(sql`${emailSendLog.id} = ${logRow.id}`)
  } else {
    await logEmailEvent({
      recipientHash,
      template: 'order_confirmation', // unknown; placeholder
      category: 'transactional',
      provider: 'brevo',
      providerMessageId: event.messageId ?? event['message-id'],
      status: 'bounced',
      statusDetail: normalizedReason,
      eventData: event as Record<string, unknown>,
    })
  }

  emailBouncedTotal.inc({ reason: normalizedReason })
  logger.info('webhook.brevo.event', {
    event: event.event,
    emailHash: recipientHash,
    messageId: event.messageId ?? event['message-id'],
    status: 'bounced',
  })

  if (normalizedReason === 'hard_bounce' || isHardBounceReason(event.reason ?? '')) {
    await suppressEmail(email, {
      reason: 'hard_bounce',
      source: event.event,
    })
  } else if (normalizedReason === 'soft_bounce') {
    const softBounceCount = await countRecentSoftBounces(recipientHash)
    if (softBounceCount >= 3) {
      const expiresAt = new Date(
        Date.now() + getEmailSuppressionSoftBounceRetentionDays() * 24 * 60 * 60 * 1000,
      )
      await suppressEmail(email, {
        reason: 'soft_bounce',
        source: event.event,
        expiresAt,
      })
    }
  }
}

async function handleComplaint(
  event: BrevoWebhookEvent,
  email: string,
  recipientHash: string,
): Promise<void> {
  const logRow = await findMatchingLogRow(event, recipientHash)

  if (logRow) {
    await db
      .update(emailSendLog)
      .set({
        status: 'complained',
        eventData: event as Record<string, unknown>,
      })
      .where(sql`${emailSendLog.id} = ${logRow.id}`)
  } else {
    await logEmailEvent({
      recipientHash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      providerMessageId: event.messageId ?? event['message-id'],
      status: 'complained',
      eventData: event as Record<string, unknown>,
    })
  }

  emailComplainedTotal.inc()
  logger.info('webhook.brevo.event', {
    event: event.event,
    emailHash: recipientHash,
    messageId: event.messageId ?? event['message-id'],
    status: 'complained',
  })

  await suppressEmail(email, {
    reason: 'spam',
    source: event.event,
  })
}

async function handleDelivered(event: BrevoWebhookEvent, recipientHash: string): Promise<void> {
  const logRow = await findMatchingLogRow(event, recipientHash)

  if (logRow) {
    await db
      .update(emailSendLog)
      .set({
        status: 'delivered',
        eventData: event as Record<string, unknown>,
      })
      .where(sql`${emailSendLog.id} = ${logRow.id}`)
  } else {
    await logEmailEvent({
      recipientHash,
      template: 'order_confirmation',
      category: 'transactional',
      provider: 'brevo',
      providerMessageId: event.messageId ?? event['message-id'],
      status: 'delivered',
      eventData: event as Record<string, unknown>,
    })
  }

  emailDeliveredTotal.inc()
  logger.info('webhook.brevo.event', {
    event: event.event,
    emailHash: recipientHash,
    messageId: event.messageId ?? event['message-id'],
    status: 'delivered',
  })
}

export async function processBrevoWebhook(request: Request): Promise<Response> {
  if (!verifyWebhookToken(request)) {
    webhookProcessedTotal.inc({ status: 'unauthorized' })
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    webhookProcessedTotal.inc({ status: 'bad_request' })
    return new Response('Bad Request', { status: 400 })
  }

  const webhookEventId = await recordWebhookEvent(request, payload)

  const events: BrevoWebhookEvent[] = Array.isArray(payload)
    ? (payload as BrevoWebhookEvent[])
    : [payload as BrevoWebhookEvent]

  let processed = 0
  let suppressed = 0

  for (const event of events) {
    const email = typeof event.email === 'string' ? event.email : undefined
    const eventName = typeof event.event === 'string' ? event.event : undefined
    if (!email || !eventName) continue

    const normalizedEvent = normalizeEventName(eventName)
    const recipientHash = await sha256Hex(email.trim().toLowerCase())

    try {
      if (DELIVERY_EVENTS.has(normalizedEvent)) {
        await handleDelivered(event, recipientHash)
        processed += 1
        continue
      }

      const reason = mapEventToReason(eventName)
      if (!reason) continue

      if (reason === 'spam') {
        await handleComplaint(event, email, recipientHash)
        suppressed += 1
      } else {
        await handleBounce(event, email, recipientHash, reason)
        if (reason === 'hard_bounce') {
          suppressed += 1
        }
      }

      processed += 1
    } catch (err) {
      logger.error('[BrevoWebhook] Failed to process event', err, {
        event: eventName,
        emailHash: recipientHash,
      })
    }
  }

  await markEventProcessed(webhookEventId, null)
  webhookProcessedTotal.inc({ status: 'ok' })
  logger.info('[BrevoWebhook] processed events', { count: events.length, processed, suppressed })

  return new Response(JSON.stringify({ ok: true, processed, suppressed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/webhooks/brevo')({
  server: {
    handlers: {
      POST: async ({ request }) => processBrevoWebhook(request),
    },
  },
})
