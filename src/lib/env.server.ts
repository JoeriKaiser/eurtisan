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
 * Required in production for live Mollie integration.
 * When absent and MOCK_PAYMENTS_ENABLED is not set to 'true', the constructor
 * will throw in production. In non-production environments the mock provider
 * is used as a fallback.
 */
export function getMollieApiKey(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.MOLLIE_API_KEY
  }
  return undefined
}

/**
 * Check if mock payments are explicitly enabled (server-only).
 * Configurable in production. When set to 'true' the mock payment provider
 * is used even when MOLLIE_API_KEY is missing, which is useful for staging
 * or demonstration environments.
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

/**
 * Mollie Connect OAuth client ID (server-only).
 * Required for seller onboarding via Mollie Connect.
 */
export function getMollieClientId(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.MOLLIE_CLIENT_ID
  }
  return undefined
}

/**
 * Mollie Connect OAuth client secret (server-only).
 * Required for exchanging the OAuth authorization code for tokens.
 */
export function getMollieClientSecret(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.MOLLIE_CLIENT_SECRET
  }
  return undefined
}

/**
 * When true, all Mollie API calls use test mode (no real money movement).
 * Defaults to true outside production, false in production.
 */
export function getMollieTestMode(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env.MOLLIE_TEST_MODE !== undefined) {
      return process.env.MOLLIE_TEST_MODE === 'true'
    }
    return process.env.NODE_ENV !== 'production'
  }
  return true
}

/**
 * When true, payout route creation is mocked (no external HTTP calls).
 * Useful for local development when MOLLIE_API_KEY is not configured.
 */
export function getMockPayoutsEnabled(): boolean {
  if (typeof process !== 'undefined') {
    return process.env.MOCK_PAYOUTS_ENABLED === 'true'
  }
  return false
}

/**
 * Interval between payout reconciliation job runs (milliseconds).
 * Defaults to 6 hours.
 */
export function getPayoutReconciliationIntervalMs(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.PAYOUT_RECONCILIATION_INTERVAL_MS
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 6 * 60 * 60 * 1000
}

/**
 * Interval between Sendcloud shipment reconciliation job runs (milliseconds).
 * Defaults to 6 hours.
 */
export function getSendcloudReconciliationIntervalMs(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.SENDCLOUD_RECONCILIATION_INTERVAL_MS
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 6 * 60 * 60 * 1000
}

/* -------------------------------------------------------------------------- */
/*  Sendcloud Shipping                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Sendcloud public key (API username) for HTTP Basic Auth.
 * Required in production for real label generation and tracking.
 */
export function getSendcloudPublicKey(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.SENDCLOUD_PUBLIC_KEY
  }
  return undefined
}

/**
 * Sendcloud secret key (API password) for HTTP Basic Auth and webhook HMAC.
 * Required in production.
 */
export function getSendcloudSecretKey(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.SENDCLOUD_SECRET_KEY
  }
  return undefined
}

/**
 * Separate secret used for webhook HMAC-SHA256 verification.
 * Defaults to the Sendcloud secret key if not set.
 */
export function getSendcloudWebhookSecret(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.SENDCLOUD_WEBHOOK_SECRET?.trim() || process.env.SENDCLOUD_SECRET_KEY
  }
  return undefined
}

/**
 * Explicit Unstamped letter shipping method ID for dev/staging.
 * If unset, the provider discovers it at runtime via GET /shipping_methods.
 */
export function getSendcloudUnstampedLetterMethodId(): number | undefined {
  if (typeof process !== 'undefined') {
    const raw = process.env.SENDCLOUD_UNSTAMPED_LETTER_METHOD_ID
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return undefined
}

/**
 * When true, all label creation is forced to the Unstamped letter method.
 * Defaults to true outside production to avoid paid labels in dev/staging.
 * Can be explicitly disabled by setting SENDCLOUD_FORCE_UNSTAMPED_LETTER=false.
 */
export function getSendcloudForceUnstampedLetter(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env.SENDCLOUD_FORCE_UNSTAMPED_LETTER !== undefined) {
      return process.env.SENDCLOUD_FORCE_UNSTAMPED_LETTER === 'true'
    }
    return process.env.NODE_ENV !== 'production'
  }
  return true
}

/* -------------------------------------------------------------------------- */
/*  Email (Brevo)                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Brevo API key for transactional email delivery (server-only).
 * Required in production when email sending is enabled.
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

/**
 * Shared secret for Brevo webhook authentication (server-only).
 * Pass as ?token= or X-Brevo-Token header. Required in production.
 */
export function getBrevoWebhookToken(): string | undefined {
  return process.env.BREVO_WEBHOOK_TOKEN?.trim() || undefined
}

export function getEmailFromAddress(): string {
  if (typeof process !== 'undefined') {
    return process.env.EMAIL_FROM_ADDRESS ?? 'support@eurtisan.eu'
  }
  return 'support@eurtisan.eu'
}

/**
 * Reply-To address for transactional emails (server-only).
 */
export function getEmailReplyToAddress(): string {
  if (typeof process !== 'undefined') {
    return process.env.EMAIL_REPLY_TO_ADDRESS ?? 'support@eurtisan.eu'
  }
  return 'support@eurtisan.eu'
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
 * Required in production when email sending is enabled.
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

/* -------------------------------------------------------------------------- */
/*  Rate limit                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Number of days to retain rate-limit rows before cleanup.
 * Defaults to 30, minimum 1.
 */
export function getRateLimitRetentionDays(): number {
  if (typeof process !== 'undefined') {
    const days = process.env.RATE_LIMIT_RETENTION_DAYS
    if (days) {
      const parsed = Number.parseInt(days, 10)
      if (!Number.isNaN(parsed)) {
        return Math.max(1, parsed)
      }
    }
  }
  return 30
}

/* -------------------------------------------------------------------------- */
/*  Email outbox & pipeline                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Polling interval for the email outbox worker (milliseconds).
 * Defaults to 10 seconds.
 */
export function getEmailOutboxWorkerIntervalMs(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_OUTBOX_WORKER_INTERVAL_MS
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 10_000
}

/**
 * Max rows to process per outbox worker tick.
 * Defaults to 50.
 */
export function getEmailOutboxWorkerBatchSize(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_OUTBOX_WORKER_BATCH_SIZE
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 50
}

/**
 * Default max retries for outbox emails.
 * Defaults to 3.
 */
export function getEmailMaxRetries(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_MAX_RETRIES
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed >= 0) {
        return parsed
      }
    }
  }
  return 3
}

/**
 * Daily per-email limit for password reset emails.
 * Defaults to 5.
 */
export function getEmailRateLimitPasswordResetPerEmailDay(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL_DAY
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 5
}

/**
 * Daily per-email limit for email verification emails.
 * Defaults to 5.
 */
export function getEmailRateLimitVerificationPerEmailDay(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_RATE_LIMIT_VERIFICATION_PER_EMAIL_DAY
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 5
}

/**
 * Hourly per-email limit for account security alert emails.
 * Defaults to 10.
 */
export function getEmailRateLimitSecurityAlertPerEmailHour(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_RATE_LIMIT_SECURITY_ALERT_PER_EMAIL_HOUR
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 10
}

/**
 * Number of days to retain soft-bounce suppressions before automatic cleanup.
 * Defaults to 30.
 */
export function getEmailSuppressionSoftBounceRetentionDays(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_SUPPRESSION_SOFT_BOUNCE_RETENTION_DAYS
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 30
}

/**
 * Number of days to retain email_send_log rows before cleanup.
 * Defaults to 90.
 */
export function getEmailSendLogRetentionDays(): number {
  if (typeof process !== 'undefined') {
    const raw = process.env.EMAIL_SEND_LOG_RETENTION_DAYS
    if (raw) {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return 90
}
