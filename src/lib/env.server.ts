/**
 * Shared environment utilities for server-side code.
 */

/**
 * Base URL for absolute references.
 * Uses PUBLIC_URL env var when set, otherwise falls back to localhost.
 */
export function getBaseUrl(): string {
  if (typeof process !== 'undefined') {
    const publicUrl = process.env.PUBLIC_URL
    if (publicUrl) {
      return publicUrl.replace(/\/+$/, '')
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PUBLIC_URL environment variable is required in production')
    }
  }
  return 'http://localhost:3000'
}

/**
 * Mollie API key (server-only).
 * Required for live Mollie integration. When absent the mock provider is used.
 */
export function getMollieApiKey(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.MOLLIE_API_KEY
  }
  return undefined
}

/**
 * Check if mock payments are explicitly enabled (server-only).
 */
export function getMockPaymentsEnabled(): boolean {
  if (typeof process !== 'undefined') {
    return process.env.MOCK_PAYMENTS_ENABLED === 'true'
  }
  return false
}

/**
 * Mollie webhook secret for signature verification (server-only).
 */
export function getMollieWebhookSecret(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.MOLLIE_WEBHOOK_SECRET
  }
  return undefined
}

/* -------------------------------------------------------------------------- */
/*  Email (Brevo)                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Brevo API key for transactional email delivery (server-only).
 * When absent the mock provider is used.
 */
export function getBrevoApiKey(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.BREVO_API_KEY
  }
  return undefined
}

/**
 * From address for transactional emails (server-only).
 */
export function getEmailFromAddress(): string {
  if (typeof process !== 'undefined') {
    return process.env.EMAIL_FROM_ADDRESS ?? 'noreply@eurtisan.eu'
  }
  return 'noreply@eurtisan.eu'
}

/**
 * From name for transactional emails (server-only).
 */
export function getEmailFromName(): string {
  if (typeof process !== 'undefined') {
    return process.env.EMAIL_FROM_NAME ?? 'Eurtisan'
  }
  return 'Eurtisan'
}

/* -------------------------------------------------------------------------- */
/*  Email (SMTP / Mailpit dev)                                              */
/* -------------------------------------------------------------------------- */

/**
 * SMTP host for local development mail capture (e.g. mailpit).
 * When set the SMTP provider is used instead of Brevo.
 */
export function getEmailSmtpHost(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.EMAIL_SMTP_HOST
  }
  return undefined
}

/**
 * SMTP port for local development mail capture.
 * Defaults to 1025 (mailpit default).
 */
export function getEmailSmtpPort(): number {
  if (typeof process !== 'undefined') {
    const port = process.env.EMAIL_SMTP_PORT
    if (port) {
      const parsed = Number.parseInt(port, 10)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }
  return 1025
}
