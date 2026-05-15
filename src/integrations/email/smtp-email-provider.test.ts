/**
 * SMTP email provider tests.
 *
 * Covers mock provider behaviour, real provider initialization, SMTP
 * configuration detection, and template rendering.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}))

import nodemailer from 'nodemailer'
import { SmtpEmailProvider, smtpEmailProvider, resetSmtpMockEmailCounter } from './smtp-email-provider'
import * as emailTemplates from '#/lib/email-templates'

beforeEach(() => {
  resetSmtpMockEmailCounter()
  vi.unstubAllEnvs()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(nodemailer.createTransport).mockReset()
})

afterAll(() => {
  resetSmtpMockEmailCounter()
})

describe('SmtpEmailProvider (mock)', () => {
  const provider = new SmtpEmailProvider({ mock: true })

  it('sends order confirmation and returns a mock message ID', async () => {
    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '42',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      items: [{ name: 'Ceramic Mug', quantity: 2, price: '€24.00' }],
      total: '€24.00',
    })

    expect(result.messageId).toMatch(/^msg_smtp_mock_\d{6}$/)
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

    expect(result.messageId).toMatch(/^msg_smtp_mock_\d{6}$/)
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

    expect(result.messageId).toMatch(/^msg_smtp_mock_\d{6}$/)
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
      orderNumber: null,
    })

    expect(result.accepted).toBe(true)
    consoleSpy.mockRestore()
  })
})

describe('SmtpEmailProvider real-mode detection', () => {
  it('defaults to mock mode when EMAIL_SMTP_HOST is not set', () => {
    vi.stubEnv('EMAIL_SMTP_HOST', '')
    const provider = new SmtpEmailProvider()

    return expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        messageId: expect.stringMatching(/^msg_smtp_mock_/),
      }),
    )
  })

  it('enters real mode when EMAIL_SMTP_HOST is present', () => {
    vi.stubEnv('EMAIL_SMTP_HOST', 'mailpit')
    vi.stubEnv('EMAIL_SMTP_PORT', '1025')

    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'smtp-msg-123' })
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: sendMailMock } as unknown as ReturnType<typeof nodemailer.createTransport>)

    const provider = new SmtpEmailProvider()

    return expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        messageId: 'smtp-msg-123',
        accepted: true,
      }),
    )
  })

  it('allows explicit mock override even when EMAIL_SMTP_HOST is set', () => {
    vi.stubEnv('EMAIL_SMTP_HOST', 'mailpit')
    const provider = new SmtpEmailProvider({ mock: true })

    return expect(
      provider.sendTransactional('buyer@example.com', 'order_confirmation', {
        orderNumber: '1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        messageId: expect.stringMatching(/^msg_smtp_mock_/),
      }),
    )
  })
})

describe('SmtpEmailProvider (real with mocked nodemailer)', () => {
  let provider: SmtpEmailProvider

  beforeEach(() => {
    vi.stubEnv('EMAIL_SMTP_HOST', 'mailpit')
    vi.stubEnv('EMAIL_SMTP_PORT', '1025')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the SMTP transport and returns a message ID', async () => {
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'smtp-msg-123' })
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: sendMailMock } as unknown as ReturnType<typeof nodemailer.createTransport>)

    provider = new SmtpEmailProvider()

    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '42',
      buyerName: 'Alice',
      shopName: 'Pottery by Alice',
      items: [{ name: 'Mug', quantity: 1, price: '€12.00' }],
      total: '€12.00',
    })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Eurtisan', address: 'noreply@eurtisan.local' },
        to: 'buyer@example.com',
        subject: expect.stringContaining('42'),
        text: expect.stringContaining('Pottery by Alice'),
        html: expect.stringContaining('Pottery by Alice'),
      }),
    )

    expect(result.messageId).toBe('smtp-msg-123')
    expect(result.accepted).toBe(true)
  })

  it('falls back to plain text when template rendering throws', async () => {
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'smtp-msg-789' })
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: sendMailMock } as unknown as ReturnType<typeof nodemailer.createTransport>)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(emailTemplates, 'renderTemplate').mockImplementation(() => {
      throw new Error('Simulated render failure')
    })

    provider = new SmtpEmailProvider()

    const result = await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '1',
    })

    expect(result.messageId).toBe('smtp-msg-789')
    expect(result.accepted).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SmtpEmailProvider] Template render error (real):',
      expect.any(Error),
    )

    consoleSpy.mockRestore()
  })

  it('uses custom sender from environment variables', async () => {
    vi.stubEnv('EMAIL_FROM_ADDRESS', 'hello@eurtisan.com')
    vi.stubEnv('EMAIL_FROM_NAME', 'Eurtisan Team')

    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-abc' })
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: sendMailMock } as unknown as ReturnType<typeof nodemailer.createTransport>)

    provider = new SmtpEmailProvider()

    await provider.sendTransactional('buyer@example.com', 'order_confirmation', {
      orderNumber: '1',
    })

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Eurtisan Team', address: 'hello@eurtisan.com' },
      }),
    )
  })
})

describe('smtpEmailProvider singleton', () => {
  it('is an instance of SmtpEmailProvider', () => {
    expect(smtpEmailProvider).toBeInstanceOf(SmtpEmailProvider)
  })
})
