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
