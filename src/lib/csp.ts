/**
 * Content Security Policy configuration for Eurtisan.
 *
 * Design decisions:
 *
 * - `script-src 'self' 'unsafe-inline'`
 *   TanStack Start injects inline hydration scripts during SSR (`window.$_TSR`
 *   bootstrap, streaming script buffers). These framework-internal scripts are
 *   required for the application to hydrate. Removing `'unsafe-inline'` would
 *   require a nonce-based approach, which needs custom server wiring to pass
 *   the nonce into `router.options.ssr.nonce` on every request. This is the
 *   recommended future migration path.
 *
 * - `style-src 'self' 'unsafe-inline'`
 *   React inline `style` props (e.g. dynamic width bars, background-image
 *   placeholders) generate inline `style` **attributes**. CSP nonces and hashes
 *   only apply to `<style>` **tags**, not to inline style attributes. A future
 *   refactor should move all inline styles to Tailwind utility classes or
 *   external CSS.
 *
 * - JSON-LD structured data (`<script type="application/ld+json">`) is
 *   non-executable; it relies on the same `'unsafe-inline'` fallback.
 *
 * - `img-src 'self' data:`
 *   Product and shop images are self-hosted (`/uploads/...`). No external
 *   image CDNs or OAuth avatars are currently used, so the broad `https:`
 *   scheme has been removed. `data:` is retained for inline base64 thumbnails
 *   and placeholders.
 */

/** External origins the frontend legitimately connects to. */
const DEFAULT_CONNECT_SRC = [
  "'self'",
  'https://api.mollie.com',
  'https://api.brevo.com',
]

function getSentryOrigin(): string | null {
  const dsn = process.env.VITE_SENTRY_DSN
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

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

/** Builds the full Content-Security-Policy header value. */
export function buildCspHeader(): string {
  const connectSrc = new Set(DEFAULT_CONNECT_SRC)

  const sentry = getSentryOrigin()
  if (sentry) connectSrc.add(sentry)

  const meilisearch = getMeilisearchOrigin()
  if (meilisearch) connectSrc.add(meilisearch)

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': "'self' 'unsafe-inline'",
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data:",
    'font-src': "'self' https://fonts.gstatic.com",
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
