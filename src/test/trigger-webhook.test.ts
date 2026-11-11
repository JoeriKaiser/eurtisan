import { describe, expect, it } from 'vitest'
import {
  buildBrevoPayload,
  buildSendcloudPayload,
  computeSendcloudSignature,
} from '../../scripts/trigger-webhook'

describe('trigger-webhook CLI helper', () => {
  it('computes valid HMAC-SHA256 signature for Sendcloud payloads', () => {
    const payload = JSON.stringify({ action: 'parcel_status_changed' })
    const secret = 'test-secret'
    const signature = computeSendcloudSignature(payload, secret)

    expect(typeof signature).toBe('string')
    expect(signature.length).toBe(64) // 256-bit hex
  })

  it('builds canonical Sendcloud payload with parcel tracking and status message', () => {
    const raw = buildSendcloudPayload('TRK123456789', 'Delivered', 42)
    const parsed = JSON.parse(raw) as {
      action: string
      parcel: { id: number; tracking_number: string; status: { message: string } }
    }

    expect(parsed.action).toBe('parcel_status_changed')
    expect(parsed.parcel.id).toBe(42)
    expect(parsed.parcel.tracking_number).toBe('TRK123456789')
    expect(parsed.parcel.status.message).toBe('Delivered')
  })

  it('builds canonical Brevo event payload with email and event type', () => {
    const raw = buildBrevoPayload('maker@example.eu', 'hard_bounce')
    const parsed = JSON.parse(raw) as { event: string; email: string; ts_event: number }

    expect(parsed.event).toBe('hard_bounce')
    expect(parsed.email).toBe('maker@example.eu')
    expect(typeof parsed.ts_event).toBe('number')
  })
})
