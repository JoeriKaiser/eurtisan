/**
 * SMTP email provider for local development.
 *
 * Routes transactional emails through an SMTP relay (e.g. mailpit) so
 * developers can inspect messages without hitting external APIs.
 *
 * When SMTP is not configured the provider falls back to mock mode.
 */

import nodemailer from 'nodemailer'
import type { EmailProvider, EmailSendResult, EmailTemplate } from '#/lib/email-provider'
import { renderFallbackPlainText, renderTemplate } from '#/lib/email-templates'
import {
  getEmailFromAddress,
  getEmailFromName,
  getEmailSmtpHost,
  getEmailSmtpPort,
} from '#/lib/env.server'

let mockCounter = 0

function nextMockMessageId(): string {
  mockCounter += 1
  return `msg_smtp_mock_${String(mockCounter).padStart(6, '0')}`
}

/** Reset the mock counter so tests are deterministic. */
export function resetSmtpMockEmailCounter(): void {
  mockCounter = 0
}

/** Returns true when SMTP is configured. */
function isSmtpConfigured(): boolean {
  return !!getEmailSmtpHost()
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly mockMode: boolean
  private readonly transporter: nodemailer.Transporter | undefined
  private readonly senderEmail: string
  private readonly senderName: string

  constructor(options?: { mock?: boolean }) {
    this.mockMode = options?.mock ?? !isSmtpConfigured()
    this.senderEmail = getEmailFromAddress()
    this.senderName = getEmailFromName()

    if (!this.mockMode) {
      this.transporter = nodemailer.createTransport({
        host: getEmailSmtpHost(),
        port: getEmailSmtpPort(),
        secure: false,
        tls: {
          rejectUnauthorized: false,
        },
      })
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
      console.error('[SmtpEmailProvider] Template render error (mock):', err)
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
  /*  Real SMTP                                                         */
  /* ------------------------------------------------------------------ */

  private async sendReal(
    to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult> {
    if (!this.transporter) {
      throw new Error('SMTP transporter is not initialised')
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
      console.error('[SmtpEmailProvider] Template render error (real):', err)
    }

    const info = await this.transporter.sendMail({
      from: { name: this.senderName, address: this.senderEmail },
      to,
      subject,
      text: textBody,
      html: htmlBody,
    })

    return {
      messageId: info.messageId ?? `smtp_${Date.now()}`,
      accepted: true,
    }
  }
}

/** Default SMTP email provider instance used by the application. */
export const smtpEmailProvider = new SmtpEmailProvider()

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
