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
 * Mollie webhook secret for signature verification (server-only).
 */
export function getMollieWebhookSecret(): string | undefined {
  if (typeof process !== 'undefined') {
    return process.env.MOLLIE_WEBHOOK_SECRET
  }
  return undefined
}
