/**
 * Per-request CSP nonce propagated from server-entry through SSR middleware.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

const cspNonceStore = new AsyncLocalStorage<string>()

export function runWithCspNonce<T>(nonce: string, fn: () => T): T {
  return cspNonceStore.run(nonce, fn)
}

export function getCspNonce(): string | undefined {
  return cspNonceStore.getStore()
}

/**
 * Adds nonce attributes to inline <script> tags in HTML responses so
 * script-src can use 'nonce-…' instead of 'unsafe-inline'.
 */
export function injectScriptNonces(html: string, nonce: string): string {
  const safeNonce = nonce.replace(/["'<>]/g, '')
  return html.replace(/<script(?![^>]*\snonce=)/gi, `<script nonce="${safeNonce}"`)
}
