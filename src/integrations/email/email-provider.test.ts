/**
 * Email provider factory and production safety tests.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { BrevoEmailProvider, brevoEmailProvider } from './brevo-email-provider'
import { createEmailProvider, SmtpEmailProvider, smtpEmailProvider } from './index'

const originalEnv: Record<string, string | undefined> = {}

function setEnv(key: string, value: string) {
  if (!(key in originalEnv)) {
    originalEnv[key] = process.env[key]
  }
  process.env[key] = value
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  // Clear the record so subsequent tests start fresh
  for (const key of Object.keys(originalEnv)) {
    delete originalEnv[key]
  }
})

describe('createEmailProvider', () => {
  it('returns SMTP provider when EMAIL_SMTP_HOST is set', () => {
    setEnv('EMAIL_SMTP_HOST', 'mailpit')
    const provider = createEmailProvider()
    expect(provider).toBe(smtpEmailProvider)
    expect(provider).toBeInstanceOf(SmtpEmailProvider)
  })

  it('returns Brevo provider when BREVO_API_KEY is set and EMAIL_SMTP_HOST is not set', () => {
    setEnv('BREVO_API_KEY', 'test-key')
    setEnv('EMAIL_SMTP_HOST', '')
    const provider = createEmailProvider()
    expect(provider).toBe(brevoEmailProvider)
    expect(provider).toBeInstanceOf(BrevoEmailProvider)
  })

  it('throws in production when no email provider is configured', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('EMAIL_SMTP_HOST', '')
    setEnv('BREVO_API_KEY', '')
    expect(() => createEmailProvider()).toThrow(
      'No email provider configured in production. Set BREVO_API_KEY or EMAIL_SMTP_HOST.',
    )
  })

  it('does not throw in development when no email provider is configured', () => {
    setEnv('NODE_ENV', 'development')
    setEnv('EMAIL_SMTP_HOST', '')
    setEnv('BREVO_API_KEY', '')
    const provider = createEmailProvider()
    expect(provider).toBe(brevoEmailProvider)
    expect(provider).toBeInstanceOf(BrevoEmailProvider)
  })
})

describe('BrevoEmailProvider production safety', () => {
  it('throws in production when mock mode is requested without BREVO_API_KEY', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('BREVO_API_KEY', '')
    expect(() => new BrevoEmailProvider({ mock: true })).toThrow(
      'No email provider configured in production. Set BREVO_API_KEY or EMAIL_SMTP_HOST.',
    )
  })

  it('does not throw in development when mock mode is requested without BREVO_API_KEY', () => {
    setEnv('NODE_ENV', 'development')
    setEnv('BREVO_API_KEY', '')
    expect(() => new BrevoEmailProvider({ mock: true })).not.toThrow()
  })

  it('does not throw in production when BREVO_API_KEY is set and mock mode is requested', () => {
    setEnv('NODE_ENV', 'production')
    setEnv('BREVO_API_KEY', 'real-key')
    expect(() => new BrevoEmailProvider({ mock: true })).not.toThrow()
  })
})
