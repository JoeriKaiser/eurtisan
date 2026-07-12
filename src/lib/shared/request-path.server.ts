/**
 * Redact sensitive query-string values from a request URL before logging.
 *
 * Only the path and query string are returned; the host and hash are never
 * included. Values for known sensitive keys (tokens, passwords, secrets, etc.)
 * are replaced with `[REDACTED]`.
 */

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'code',
  'state',
  'secret',
  'password',
  'api_key',
  'apikey',
  'authorization',
  'refresh_token',
  'access_token',
  'id_token',
])

export function getSafeRequestPath(url: string | undefined): string {
  if (!url) return '/'
  const [path, query] = url.split('?')
  if (!query) return path
  const params = new URLSearchParams(query)
  for (const key of params.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]')
    }
  }
  return `${path}?${params.toString()}`
}
