/**
 * Brevo transactional webhook — POST /api/webhooks/brevo
 *
 * Ingests delivery events (bounces, complaints) and suppresses bad addresses.
 * Configure Brevo to POST here with ?token=<BREVO_WEBHOOK_TOKEN>.
 */
import { createFileRoute } from '@tanstack/react-router'
import { getBrevoWebhookToken } from '#/lib/env.server'
import {
  type EmailSuppressionReason,
  suppressEmail,
} from '#/lib/email-suppression.server'
import { logger } from '#/lib/logger.server'
import { webhookProcessedTotal } from '#/lib/metrics.server'

export interface BrevoWebhookEvent {
  event?: string
  email?: string
  reason?: string
}

const HARD_BOUNCE_EVENTS = new Set(['hard_bounce', 'hardBounce', 'invalid_email', 'invalid'])
const SOFT_BOUNCE_EVENTS = new Set(['soft_bounce', 'softBounce'])
const SPAM_EVENTS = new Set(['spam', 'complaint', 'blocked'])

function mapEventToReason(event: string): EmailSuppressionReason | null {
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

function verifyWebhookToken(request: Request): boolean {
  const expected = getBrevoWebhookToken()
  if (!expected) {
    // Dev/staging without token: allow (log once per process in handler)
    return process.env.NODE_ENV !== 'production'
  }
  const url = new URL(request.url)
  const token =
    url.searchParams.get('token') ??
    request.headers.get('x-brevo-token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return token === expected
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

  const events: BrevoWebhookEvent[] = Array.isArray(payload)
    ? (payload as BrevoWebhookEvent[])
    : [payload as BrevoWebhookEvent]

  let suppressed = 0
  for (const event of events) {
    const email = typeof event.email === 'string' ? event.email : undefined
    const eventName = typeof event.event === 'string' ? event.event : undefined
    if (!email || !eventName) continue

    const reason = mapEventToReason(eventName)
    if (!reason) continue

    await suppressEmail(email, reason, eventName)
    suppressed += 1
  }

  webhookProcessedTotal.inc({ status: 'ok' })
  logger.info('[BrevoWebhook] processed events', { count: events.length, suppressed })

  return new Response(JSON.stringify({ ok: true, suppressed }), {
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
