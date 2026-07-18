import '@tanstack/react-start/server-only'

/**
 * Content Security Policy configuration for Eurtisan.
 *
 * Design decisions:
 *
 * - `script-src 'self' 'nonce-…'` (production)
 *   A per-request nonce is generated in `server-entry.mjs`, applied to inline
 *   hydration `<script>` tags in the CSP middleware, and included in the CSP
 *   header. Development skips CSP entirely for easier debugging.
 *
 * - `style-src 'self'`
 *   Stylesheets (via `<link>` or `@import`) are restricted to self-hosted only.
 *
 * - `style-src-attr 'unsafe-inline'`
 *   Inline `style` attributes are allowed. The app uses them for dynamic
 *   runtime values that cannot be expressed via Tailwind utilities (e.g.
 *   password strength bar width, `white-space: nowrap` for truncated text in
 *   menus). These are safe because they are controlled by the application
 *   code, not user-supplied values.
 *
 * - JSON-LD structured data (`<script type="application/ld+json">`) receives
 *   the same nonce attribute as executable scripts.
 *
 * - `img-src 'self' data:`
 *   Product and shop images are served via imgproxy / S3-compatible storage.
 *   `data:` is retained for inline base64 thumbnails and placeholders.
 *
 * - `font-src 'self'`
 *   Fonts are self-hosted in `/fonts/` to eliminate the external dependency
 *   and enable stricter cross-origin isolation policies.
 */

/** External origins the frontend legitimately connects to. */
const DEFAULT_CONNECT_SRC = ["'self'", 'https://api.mollie.com', 'https://api.brevo.com']

/** External origins the frontend legitimately loads scripts from. */
const DEFAULT_SCRIPT_SRC = ["'self'"]

function getMeilisearchOrigin(): string | null {
  const host = process.env.VITE_MEILISEARCH_HOST
  if (!host) return null
  try {
    const url = new URL(host)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function getStorageOrigin(): string | null {
  const endpoint = process.env.S3_PUBLIC_ENDPOINT
  if (!endpoint) return null
  try {
    const url = new URL(endpoint)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function getUmamiScriptOrigin(): string | null {
  const url = process.env.VITE_UMAMI_SCRIPT_URL
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function getUmamiHostOrigin(): string | null {
  const host = process.env.VITE_UMAMI_HOST_URL
  if (!host) return null
  try {
    const parsed = new URL(host)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

export interface BuildCspHeaderOptions {
  /** Cryptographic nonce for inline scripts (production). */
  nonce?: string
}

/** Builds the full Content-Security-Policy header value. */
export function buildCspHeader(options: BuildCspHeaderOptions = {}): string {
  const connectSrc = new Set(DEFAULT_CONNECT_SRC)
  const scriptSrc = new Set(DEFAULT_SCRIPT_SRC)

  if (options.nonce) {
    scriptSrc.add(`'nonce-${options.nonce}'`)
  } else {
    scriptSrc.add("'unsafe-inline'")
  }

  const meilisearch = getMeilisearchOrigin()
  if (meilisearch) connectSrc.add(meilisearch)

  const storage = getStorageOrigin()
  if (storage) connectSrc.add(storage)

  const umamiScript = getUmamiScriptOrigin()
  if (umamiScript) {
    scriptSrc.add(umamiScript)
    connectSrc.add(umamiScript)
  }

  const umamiHost = getUmamiHostOrigin()
  if (umamiHost) connectSrc.add(umamiHost)

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': Array.from(scriptSrc).join(' '),
    'style-src': "'self'",
    'style-src-attr': "'unsafe-inline'",
    'img-src': "'self' data:",
    'font-src': "'self'",
    'connect-src': Array.from(connectSrc).join(' '),
    'frame-src': "'self' https://checkout.mollie.com",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
  }

  return Object.entries(directives)
    .map(([key, value]) => `${key} ${value}`)
    .join('; ')
}
