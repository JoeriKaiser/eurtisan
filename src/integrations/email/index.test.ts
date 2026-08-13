/**
 * Email integration factory tests.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrevoEmailProvider } from './brevo-email-provider'
import { brevoEmailProvider, createEmailProvider, smtpEmailProvider } from './index'
import { SmtpEmailProvider } from './smtp-email-provider'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createEmailProvider', () => {
  it('returns SMTP provider when EMAIL_SMTP_HOST is set', () => {
    vi.stubEnv('EMAIL_SMTP_HOST', 'mailpit')
    const provider = createEmailProvider()
    expect(provider).toBe(smtpEmailProvider)
    expect(provider).toBeInstanceOf(SmtpEmailProvider)
  })

  it('returns Brevo provider when EMAIL_SMTP_HOST is not set', () => {
    vi.stubEnv('EMAIL_SMTP_HOST', '')
    const provider = createEmailProvider()
    expect(provider).toBe(brevoEmailProvider)
    expect(provider).toBeInstanceOf(BrevoEmailProvider)
  })
})
