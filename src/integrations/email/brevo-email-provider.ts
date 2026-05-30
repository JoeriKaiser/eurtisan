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
import { renderFallbackPlainText, renderTemplate } from '#/lib/email-templates'
import { getBrevoApiKey, getEmailFromAddress, getEmailFromName } from '#/lib/env.server'
import { logger } from '#/lib/logger.server'

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

    if (process.env.NODE_ENV === 'production' && this.mockMode && !this.apiKey) {
      throw new Error(
        'No email provider configured in production. Set BREVO_API_KEY or EMAIL_SMTP_HOST.',
      )
    }
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
    _to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult> {
    await delay(20)

    try {
      renderTemplate(template, data)
    } catch (err) {
      renderFallbackPlainText(template, data)
      logger.error('[BrevoEmailProvider] Template render error (mock)', err)
    }

    const messageId = nextMockMessageId()

    logger.info('[MockEmail] message sent', {
      messageId,
      to: '[REDACTED]',
    })

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
    const apiKey = this.apiKey
    if (!apiKey) {
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
      logger.error('[BrevoEmailProvider] Template render error (real)', err)
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

    const response = await retryWithBackoff(
      async () => {
        let resp: Response
        try {
          resp = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('Brevo email send timed out after 10 seconds')
          }
          throw err
        }

        if (!resp.ok) {
          const errorBody = await resp.text()
          throw new Error(`Brevo API error (${resp.status}): ${errorBody}`)
        }

        return resp
      },
      (err) => {
        // Do not retry intentional timeouts
        if (err instanceof Error && err.message === 'Brevo email send timed out after 10 seconds') {
          return false
        }
        // Retry network errors (fetch throws TypeError)
        if (err instanceof TypeError) {
          return true
        }
        // Retry only 5xx API errors, not 4xx
        if (err instanceof Error && err.message.startsWith('Brevo API error (')) {
          const statusMatch = err.message.match(/Brevo API error \((\d{3})\):/)
          if (statusMatch) {
            const status = Number.parseInt(statusMatch[1], 10)
            return status >= 500
          }
        }
        return false
      },
    )

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

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  delays = [1000, 2000, 4000],
): Promise<T> {
  let lastError: unknown

  for (let i = 0; i <= delays.length; i++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      if (i === delays.length || !shouldRetry(err)) {
        throw err
      }
      await delay(delays[i])
    }
  }

  throw lastError
}
