/**
 * Email integration exports.
 *
 * Re-exports providers and a factory so callers only need to import from
 * `#/integrations/email`. The factory selects SMTP when configured (e.g.
 * mailpit in docker-compose dev) and falls back to Brevo for production.
 */

export {
  BrevoEmailProvider,
  brevoEmailProvider,
  resetMockEmailCounter,
} from './brevo-email-provider'

export {
  SmtpEmailProvider,
  smtpEmailProvider,
  resetSmtpMockEmailCounter,
} from './smtp-email-provider'

import type { EmailProvider } from '#/lib/email-provider'
import { getEmailSmtpHost } from '#/lib/env.server'
import { brevoEmailProvider } from './brevo-email-provider'
import { smtpEmailProvider } from './smtp-email-provider'

/**
 * Return the active email provider for the current environment.
 *
 * Prefers SMTP (e.g. mailpit) when `EMAIL_SMTP_HOST` is configured,
 * otherwise falls back to the Brevo HTTP API provider.
 */
export function createEmailProvider(): EmailProvider {
  if (getEmailSmtpHost()) {
    return smtpEmailProvider
  }
  return brevoEmailProvider
}
