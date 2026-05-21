/**
 * Email provider abstraction for transactional email delivery.
 *
 * The provider interface is intentionally small: a single `sendTransactional`
 * call that selects the correct template, renders it, and delivers the email.
 * This keeps business flows decoupled from template and transport details.
 */

/** Supported transactional email templates. */
export type EmailTemplate =
  | 'order_confirmation'
  | 'shipping_notification'
  | 'dispute_update'
  | 'email_verification'
  | 'password_reset'

/** Result returned after attempting to send an email. */
export interface EmailSendResult {
  /** Provider-specific message identifier (mock IDs are fine in dev). */
  messageId: string
  /** Whether the message was accepted by the provider (not a guarantee of delivery). */
  accepted: boolean
}

/**
 * Email provider interface.
 *
 * Every email provider must implement this method. The implementation is
 * injected into notification and business flows so it can be swapped for a
 * mock in development or for a different provider in production.
 */
export interface EmailProvider {
  /**
   * Send a transactional email using the named template.
   *
   * The provider is responsible for:
   *   1. Rendering the HTML and plain-text bodies from the template + data.
   *   2. Catching render errors and falling back to a plain-text email.
   *   3. Delivering the message via the underlying transport.
   *
   * @param to - Recipient email address.
   * @param template - Template identifier.
   * @param data - Template variables (specific to each template).
   */
  sendTransactional(
    to: string,
    template: EmailTemplate,
    data: Record<string, unknown>,
  ): Promise<EmailSendResult>
}
