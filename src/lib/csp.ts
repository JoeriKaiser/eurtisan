/**
 * Content Security Policy configuration for Eurtisan.
 *
 * Design decisions:
 *
 * - `script-src 'self' 'unsafe-inline'`
 *   TanStack Start injects inline hydration scripts during SSR (`window.$_TSR`
 *   bootstrap, streaming script buffers). These framework-internal scripts are
 *   required for the application to hydrate. A nonce-based approach would
 *   require custom server wiring to pass the nonce into
 *   `router.options.ssr.nonce` on every request.
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
 * - JSON-LD structured data (`<script type="application/ld+json">`) is
 *   non-executable; it relies on the same `'unsafe-inline'` fallback under
 *   `script-src`.
 *
 * - `img-src 'self' data:`
 *   Product and shop images are self-hosted (`/uploads/...`). No external
 *   image CDNs or OAuth avatars are currently used, so the broad `https:`
 *   scheme has been removed. `data:` is retained for inline base64 thumbnails
 *   and placeholders.
 *
 * - `font-src 'self'`
 *   Fonts are self-hosted in `/fonts/` to eliminate the external dependency
 *   and enable stricter cross-origin isolation policies.
 */

/** External origins the frontend legitimately connects to. */
const DEFAULT_CONNECT_SRC = ["'self'", 'https://api.mollie.com', 'https://api.brevo.com']

/** External origins the frontend legitimately loads scripts from. */
const DEFAULT_SCRIPT_SRC = ["'self'", "'unsafe-inline'"]

function getMeilisearchOrigin(): string | null {
  const host = process.env.MEILISEARCH_HOST
  if (!host) return null
  try {
    const url = new URL(host)
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

/** Builds the full Content-Security-Policy header value. */
export function buildCspHeader(): string {
  const connectSrc = new Set(DEFAULT_CONNECT_SRC)
  const scriptSrc = new Set(DEFAULT_SCRIPT_SRC)

  const meilisearch = getMeilisearchOrigin()
  if (meilisearch) connectSrc.add(meilisearch)

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
