/**
 * Brevo (formerly Sendinblue) email provider.
 *
 * Uses the Brevo v3 transactional email API. All requests are sent to
 * `api.brevo.com` which is hosted in the EU (France).
 *
 * When BREVO_API_KEY is not configured the provider falls back to mock mode
 * so development and tests do not send real emails.
 */

import type { EmailProvider, EmailSendResult, EmailTemplate } from '#/lib/email-provider'
import {
  getBrevoApiKey,
  getEmailFromAddress,
  getEmailFromName,
} from '#/lib/env.server'
import { renderFallbackPlainText, renderTemplate } from '#/lib/email-templates'

/** Brevo SMTP API endpoint. */
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

let mockCounter = 0

function nextMockMessageId(): string {
  mockCounter += 1
  return `msg_mock_${String(mockCounter).padStart(6, '0')}`
}

/** Reset the mock counter so tests are deterministic. */
export function resetMockEmailCounter(): void {
  mockCounter = 0
}

/** Returns true when the environment is configured for real Brevo sending. */
function isRealModeEnabled(): boolean {
  return !!getBrevoApiKey()
}

/** Build the sender address from environment or fallback. */
function getSenderEmail(): string {
  return getEmailFromAddress()
}

function getSenderName(): string {
  return getEmailFromName()
}

export class BrevoEmailProvider implements EmailProvider {
  private readonly mockMode: boolean
  private readonly apiKey: string | undefined
  private readonly senderEmail: string
  private readonly senderName: string

  constructor(options?: { mock?: boolean }) {
    this.mockMode = options?.mock ?? !isRealModeEnabled()
    this.apiKey = getBrevoApiKey()
    this.senderEmail = getSenderEmail()
    this.senderName = getSenderName()
  }

  async sendTransactional(
    to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult> {
    if (this.mockMode) {
      return this.sendMock(to, template, data)
    }

    return this.sendReal(to, template, data)
  }

  /* ------------------------------------------------------------------ */
  /*  Mock / no-op                                                       */
  /* ------------------------------------------------------------------ */

  private async sendMock(
    to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult> {
    await delay(20)

    let subject = ''
    let html: string | undefined
    let text = ''

    try {
      const rendered = renderTemplate(template, data)
      subject = rendered.subject
      html = rendered.html
      text = rendered.text
    } catch (err) {
      const fallback = renderFallbackPlainText(template, data)
      subject = fallback.subject
      text = fallback.text
      console.error('[BrevoEmailProvider] Template render error (mock):', err)
    }

    const messageId = nextMockMessageId()

    // eslint-disable-next-line no-console
    console.log(`[MockEmail] ${messageId}`)
    // eslint-disable-next-line no-console
    console.log(`  To:      ${to}`)
    // eslint-disable-next-line no-console
    console.log(`  Subject: ${subject}`)
    // eslint-disable-next-line no-console
    console.log(`  HTML:    ${html ? `${html.slice(0, 120)}...` : '(none)'}`)
    // eslint-disable-next-line no-console
    console.log(`  Text:    ${text.slice(0, 120)}...`)

    return { messageId, accepted: true }
  }

  /* ------------------------------------------------------------------ */
  /*  Real Brevo API                                                     */
  /* ------------------------------------------------------------------ */

  private async sendReal(
    to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult> {
    if (!this.apiKey) {
      throw new Error('BREVO_API_KEY is not set')
    }

    let subject = ''
    let htmlBody: string | undefined
    let textBody = ''

    try {
      const rendered = renderTemplate(template, data)
      subject = rendered.subject
      htmlBody = rendered.html
      textBody = rendered.text
    } catch (err) {
      const fallback = renderFallbackPlainText(template, data)
      subject = fallback.subject
      textBody = fallback.text
      console.error('[BrevoEmailProvider] Template render error (real):', err)
    }

    const payload: Record<string, unknown> = {
      sender: { email: this.senderEmail, name: this.senderName },
      to: [{ email: to }],
      subject,
      textContent: textBody,
    }

    if (htmlBody) {
      payload.htmlContent = htmlBody
    }

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Brevo API error (${response.status}): ${errorBody}`)
    }

    const result = (await response.json()) as { messageId?: string }
    return {
      messageId: result.messageId ?? `brevo_${Date.now()}`,
      accepted: true,
    }
  }
}

/** Default Brevo email provider instance used by the application. */
export const brevoEmailProvider = new BrevoEmailProvider()

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
