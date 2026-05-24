/**
 * Email provider tests.
 *
 * Covers mock provider behaviour, real provider initialization, and mock/real
 * mode detection.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BrevoEmailProvider, brevoEmailProvider, resetMockEmailCounter } from '#/integrations/email'
import * as emailTemplates from './email-templates'

beforeEach(() => {
  resetMockEmailCounter()
  vi.unstubAllEnvs()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  resetMockEmailCounter()
})

describe('BrevoEmailProvider (mock)', () => {
  const provider = new BrevoEmailProvider({ mock: true })

  it('sends order confirmation and returns a mock message ID', async () => {
    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '42',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      items: [{ name: 'Ceramic Mug', quantity: 2, price: '€24.00' }],
      total: '€24.00',
    })

    expect(result.messageId).toMatch(/^msg_mock_\d{6}$/)
    expect(result.accepted).toBe(true)
  })

  it('sends shipping notification and returns a mock message ID', async () => {
    const result = await provider.sendTransactional('buyer@example.com', 'shipping_notification', {
      orderNumber: '42',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      trackingNumber: 'MR12345678',
      carrier: 'Mondial Relay',
      estimatedDelivery: '2026-05-20',
    })

    expect(result.messageId).toMatch(/^msg_mock_\d{6}$/)
    expect(result.accepted).toBe(true)
  })

  it('sends dispute update and returns a mock message ID', async () => {
    const result = await provider.sendTransactional('buyer@example.com', 'dispute_update', {
      orderNumber: '42',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      status: 'resolved',
      message: 'Refund issued.',
    })

    expect(result.messageId).toMatch(/^msg_mock_\d{6}$/)
    expect(result.accepted).toBe(true)
  })

  it('generates unique message IDs across calls', async () => {
    const r1 = await provider.sendTransactional('a@example.com', 'order_confirmation', {
      orderNumber: '1',
    })
    const r2 = await provider.sendTransactional('b@example.com', 'order_confirmation', {
      orderNumber: '2',
    })

    expect(r1.messageId).not.toBe(r2.messageId)
  })

  it('falls back to plain text when template data is malformed', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      // Missing required fields — template render still works with defaults
      orderNumber: null,
    })

    expect(result.accepted).toBe(true)
    // Should not throw; console.error may or may not be called depending on
    // whether the template renderer throws with null data.
    consoleSpy.mockRestore()
  })
})

describe('BrevoEmailProvider real-mode detection', () => {
  it('defaults to mock mode when BREVO_API_KEY is not set', () => {
    vi.stubEnv('BREVO_API_KEY', '')
    const provider = new BrevoEmailProvider()

    return expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        messageId: expect.stringMatching(/^msg_mock_/),
      }),
    )
  })

  it('enters real mode when BREVO_API_KEY is present', () => {
    vi.stubEnv('BREVO_API_KEY', 'test_live_key')
    const provider = new BrevoEmailProvider()

    // Real mode will attempt a fetch and throw because there is no network mock
    return expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).rejects.toThrow()
  })

  it('allows explicit mock override even when BREVO_API_KEY is set', () => {
    vi.stubEnv('BREVO_API_KEY', 'test_live_key')
    const provider = new BrevoEmailProvider({ mock: true })

    return expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        messageId: expect.stringMatching(/^msg_mock_/),
      }),
    )
  })
})

describe('BrevoEmailProvider (real with mocked fetch)', () => {
  let provider: BrevoEmailProvider

  beforeEach(() => {
    vi.stubEnv('BREVO_API_KEY', 'test_live_key')
    provider = new BrevoEmailProvider()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the Brevo API and returns a message ID', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ messageId: 'brevo-msg-123' }), { status: 201 }),
      )

    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '42',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      items: [{ name: 'Mug', quantity: 1, price: '€12.00' }],
      total: '€12.00',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': 'test_live_key',
          'Content-Type': 'application/json',
        }),
      }),
    )

    expect(result.messageId).toBe('brevo-msg-123')
    expect(result.accepted).toBe(true)
  })

  it('sends htmlContent and textContent when rendering succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ messageId: 'brevo-msg-456' }), { status: 201 }),
      )

    await provider.sendTransactional('buyer@example.com', 'shipping_notification', {
      orderNumber: '99',
      buyerName: 'Bob',
      shopName: 'Woodworks',
      trackingNumber: 'TRK-1',
      carrier: 'DHL',
      estimatedDelivery: '2026-05-25',
    })

    const requestBody = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit)?.body as string)

    expect(requestBody).toMatchObject({
      sender: { email: 'noreply@eurtisan.eu', name: 'Eurtisan' },
      to: [{ email: 'buyer@example.com' }],
      subject: expect.stringContaining('99'),
      textContent: expect.stringContaining('Woodworks'),
      htmlContent: expect.stringContaining('Woodworks'),
    })
  })

  it('falls back to plain text when template rendering throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messageId: 'brevo-msg-789' }), { status: 201 }),
    )

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(emailTemplates, 'renderTemplate').mockImplementation(() => {
      throw new Error('Simulated render failure')
    })

    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '1',
    })

    expect(result.messageId).toBe('brevo-msg-789')
    expect(result.accepted).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[BrevoEmailProvider] Template render error (real):',
      expect.any(Error),
    )

    consoleSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('throws on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'unauthorized', message: 'Invalid API key' }), {
        status: 401,
      }),
    )

    await expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).rejects.toThrow('Brevo API error (401)')
  })

  it('uses custom sender from environment variables', async () => {
    vi.stubEnv('EMAIL_FROM_ADDRESS', 'hello@eurtisan.eu')
    vi.stubEnv('EMAIL_FROM_NAME', 'Eurtisan Team')

    const customProvider = new BrevoEmailProvider()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ messageId: 'msg-abc' }), { status: 201 }))

    await customProvider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '1',
    })

    const requestBody = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit)?.body as string)
    expect(requestBody.sender).toEqual({ email: 'hello@eurtisan.eu', name: 'Eurtisan Team' })
  })
})

describe('brevoEmailProvider singleton', () => {
  it('is an instance of BrevoEmailProvider', () => {
    expect(brevoEmailProvider).toBeInstanceOf(BrevoEmailProvider)
  })
})
