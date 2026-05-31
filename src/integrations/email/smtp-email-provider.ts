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
import { logger } from '#/lib/logger.server'
import {
  getEmailFromAddress,
  getEmailFromName,
  getEmailReplyToAddress,
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
  private readonly replyTo: string

  constructor(options?: { mock?: boolean }) {
    this.mockMode = options?.mock ?? !isSmtpConfigured()
    this.senderEmail = getEmailFromAddress()
    this.senderName = getEmailFromName()
    this.replyTo = getEmailReplyToAddress()

    if (!this.mockMode) {
      const host = getEmailSmtpHost()
      if (!host) {
        throw new Error('SMTP host is not configured')
      }
      const isDevServer = host === 'mailpit' || host === 'localhost' || host === '127.0.0.1'
      const skipTlsVerify = process.env.NODE_ENV !== 'production' || isDevServer

      this.transporter = nodemailer.createTransport({
        host,
        port: getEmailSmtpPort(),
        secure: false,
        tls: skipTlsVerify ? { rejectUnauthorized: false } : undefined,
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
    _to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult> {
    await delay(20)

    try {
      renderTemplate(template, data)
    } catch (err) {
      renderFallbackPlainText(template, data)
      logger.error('[SmtpEmailProvider] Template render error (mock)', err)
    }

    const messageId = nextMockMessageId()

    logger.info('[MockEmail] message sent', {
      messageId,
      to: '[REDACTED]',
    })

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
      logger.error('[SmtpEmailProvider] Template render error (real)', err)
    }

    const info = await this.transporter.sendMail({
      from: { name: this.senderName, address: this.senderEmail },
      to,
      subject,
      text: textBody,
      html: htmlBody,
      replyTo: this.replyTo,
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
