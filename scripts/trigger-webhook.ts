#!/usr/bin/env bun
/**
 * Local webhook simulator CLI.
 *
 * Constructs, signs, and POSTs canonical vendor webhook payloads directly to
 * http://localhost:3000/api/webhooks/{mollie,sendcloud,brevo}.
 *
 * Usage:
 *   bun run scripts/trigger-webhook.ts mollie [paymentId]
 *   bun run scripts/trigger-webhook.ts sendcloud [trackingNumber] [--status <status>] [--parcel-id <id>]
 *   bun run scripts/trigger-webhook.ts brevo [email] [--event <event>]
 */
import { createHmac } from 'node:crypto'
import { desc, isNotNull } from 'drizzle-orm'
import { db } from '../src/db/index'
import { platformOrder, shippingLabel } from '../src/db/schema'

const BASE_URL = process.env.WEBHOOK_TARGET_URL || 'http://localhost:3000'

export function computeSendcloudSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function buildSendcloudPayload(
  trackingNumber: string,
  statusMessage: string,
  parcelId = 10001,
) {
  return JSON.stringify({
    action: 'parcel_status_changed',
    parcel: {
      id: parcelId,
      tracking_number: trackingNumber,
      status: {
        message: statusMessage,
      },
    },
  })
}

export function buildBrevoPayload(email: string, event: string) {
  return JSON.stringify({
    event,
    email,
    id: Date.now(),
    date: new Date().toISOString(),
    ts_event: Math.floor(Date.now() / 1000),
  })
}

async function handleMollie(args: string[]): Promise<void> {
  let paymentId = args[0]
  if (!paymentId || paymentId.startsWith('--')) {
    try {
      const [latest] = await db
        .select({ paymentId: platformOrder.molliePaymentId })
        .from(platformOrder)
        .where(isNotNull(platformOrder.molliePaymentId))
        .orderBy(desc(platformOrder.createdAt))
        .limit(1)
      if (latest?.paymentId) {
        paymentId = latest.paymentId
        console.log(`[mollie] Auto-discovered latest payment ID: ${paymentId}`)
      }
    } catch {
      // Database not reachable or empty
    }
  }

  if (!paymentId || paymentId.startsWith('--')) {
    console.error('Error: No payment ID provided and none found in local database.')
    console.error('Usage: bun run scripts/trigger-webhook.ts mollie <paymentId>')
    process.exit(1)
  }

  console.log(
    `[mollie] Posting payment webhook for ${paymentId} to ${BASE_URL}/api/webhooks/mollie...`,
  )
  const response = await fetch(`${BASE_URL}/api/webhooks/mollie`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `id=${encodeURIComponent(paymentId)}`,
  })

  const text = await response.text()
  console.log(`[mollie] HTTP ${response.status}: ${text || '(empty body)'}`)
  if (!response.ok) process.exit(1)
}

async function handleSendcloud(args: string[]): Promise<void> {
  let trackingNumber = args[0] && !args[0].startsWith('--') ? args[0] : undefined
  let status = 'delivered'
  let parcelId = 10001

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status' && args[i + 1]) {
      status = args[i + 1]
      i++
    } else if (args[i] === '--parcel-id' && args[i + 1]) {
      parcelId = Number(args[i + 1]) || parcelId
      i++
    }
  }

  if (!trackingNumber) {
    try {
      const [latest] = await db
        .select({
          trackingNumber: shippingLabel.trackingNumber,
          externalParcelId: shippingLabel.externalParcelId,
        })
        .from(shippingLabel)
        .where(isNotNull(shippingLabel.trackingNumber))
        .orderBy(desc(shippingLabel.createdAt))
        .limit(1)
      if (latest?.trackingNumber) {
        trackingNumber = latest.trackingNumber
        if (latest.externalParcelId) parcelId = Number(latest.externalParcelId) || parcelId
        console.log(`[sendcloud] Auto-discovered latest tracking number: ${trackingNumber}`)
      }
    } catch {
      // Database not reachable or empty
    }
  }

  if (!trackingNumber) {
    console.error('Error: No tracking number provided and none found in local database.')
    console.error(
      'Usage: bun run scripts/trigger-webhook.ts sendcloud <trackingNumber> [--status <status>]',
    )
    process.exit(1)
  }

  const secret =
    process.env.SENDCLOUD_WEBHOOK_SECRET?.trim() ||
    process.env.SENDCLOUD_SECRET_KEY?.trim() ||
    'dev-sendcloud-webhook-secret'

  const payload = buildSendcloudPayload(trackingNumber, status, parcelId)
  const signature = computeSendcloudSignature(payload, secret)

  console.log(
    `[sendcloud] Posting parcel ${trackingNumber} (${status}) to ${BASE_URL}/api/webhooks/sendcloud...`,
  )
  const response = await fetch(`${BASE_URL}/api/webhooks/sendcloud`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Sendcloud-Signature': signature,
    },
    body: payload,
  })

  const text = await response.text()
  console.log(`[sendcloud] HTTP ${response.status}: ${text || '(empty body)'}`)
  if (!response.ok) process.exit(1)
}

async function handleBrevo(args: string[]): Promise<void> {
  let email = args[0] && !args[0].startsWith('--') ? args[0] : 'buyer@example.com'
  let event = 'delivered'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--event' && args[i + 1]) {
      event = args[i + 1]
      i++
    } else if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1]
      i++
    }
  }

  const payload = buildBrevoPayload(email, event)
  const token = process.env.BREVO_WEBHOOK_TOKEN?.trim()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  console.log(
    `[brevo] Posting email event ${event} for ${email} to ${BASE_URL}/api/webhooks/brevo...`,
  )
  const response = await fetch(`${BASE_URL}/api/webhooks/brevo`, {
    method: 'POST',
    headers,
    body: payload,
  })

  const text = await response.text()
  console.log(`[brevo] HTTP ${response.status}: ${text || '(empty body)'}`)
  if (!response.ok) process.exit(1)
}

async function main(): Promise<void> {
  const [subcommand, ...rest] = process.argv.slice(2)

  switch (subcommand) {
    case 'mollie':
      await handleMollie(rest)
      break
    case 'sendcloud':
      await handleSendcloud(rest)
      break
    case 'brevo':
      await handleBrevo(rest)
      break
    default:
      console.log(`Usage: bun run scripts/trigger-webhook.ts <command> [options]

Commands:
  mollie [paymentId]                                Trigger Mollie payment webhook
  sendcloud [trackingNumber] [--status <status>]    Trigger Sendcloud parcel status webhook
  brevo [email] [--event <event>]                   Trigger Brevo email status webhook
`)
      process.exit(subcommand ? 1 : 0)
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('Trigger webhook failed:', err)
    process.exit(1)
  })
}
