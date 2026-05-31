import { describe, expect, it, vi, beforeEach } from 'vitest'
import { processBrevoWebhook } from './brevo'

vi.mock('#/lib/env.server', () => ({
  getBrevoWebhookToken: vi.fn(() => 'test-secret'),
}))

vi.mock('#/lib/email-suppression.server', () => ({
  suppressEmail: vi.fn(),
}))

vi.mock('#/lib/metrics.server', () => ({
  webhookProcessedTotal: { inc: vi.fn() },
}))

describe('processBrevoWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing token when configured', async () => {
    const res = await processBrevoWebhook(
      new Request('http://localhost/api/webhooks/brevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'hard_bounce', email: 'bad@example.com' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('suppresses hard bounces', async () => {
    const { suppressEmail } = await import('#/lib/email-suppression.server')
    const res = await processBrevoWebhook(
      new Request('http://localhost/api/webhooks/brevo?token=test-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'hard_bounce', email: 'bad@example.com' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(suppressEmail).toHaveBeenCalledWith('bad@example.com', 'hard_bounce', 'hard_bounce')
  })
})
