import {
  initializeFaro,
  getWebInstrumentations,
  type Faro,
  TransportItemType,
} from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'

let faroInstance: Faro | undefined

/**
 * Simple non-cryptographic hash for redacting user IDs.
 * Produces a stable, deterministic identifier that cannot be reversed.
 */
function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `uid-${Math.abs(hash).toString(16)}`
}

export function getFaro(): Faro | undefined {
  return faroInstance
}

export function initFaro(): Faro | undefined {
  // Guard: SSR / Node.js / already initialized
  if (typeof window === 'undefined') return undefined
  if (faroInstance) return faroInstance
  if (import.meta.env.VITE_FARO_ENABLED !== 'true') return undefined

  const collectorUrl = import.meta.env.VITE_FARO_COLLECTOR_URL
  if (!collectorUrl) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[Faro] VITE_FARO_COLLECTOR_URL is not set. RUM disabled.')
    }
    return undefined
  }

  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[Faro] Skipped: Do Not Track is enabled')
    }
    return undefined
  }

  // Sampling: only in production, configurable via env var, default 10%
  if (import.meta.env.PROD) {
    const sampleRate = Number(import.meta.env.VITE_FARO_SAMPLE_RATE)
    if (Number.isFinite(sampleRate) && Math.random() >= sampleRate) {
      return undefined
    }
  }

  faroInstance = initializeFaro({
    url: collectorUrl,
    app: {
      name: import.meta.env.VITE_FARO_APP_NAME,
      version: import.meta.env.VITE_APP_VERSION,
      environment: import.meta.env.VITE_APP_ENV,
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: false,
      }),
      new TracingInstrumentation(),
    ],
    // sessionStorage only (ephemeral, tab-bound). No cookies. No localStorage.
    sessionTracking: {
      persistent: false,
    },
    beforeSend: (event) => {
      // Optional dev fallback: log errors to console so they are not lost if the collector is unreachable
      if (import.meta.env.DEV && event.type === TransportItemType.EXCEPTION) {
        const payload = event.payload as { type?: string; value?: string; stacktrace?: unknown }
        // eslint-disable-next-line no-console
        console.error(
          '[Faro] Exception event (fallback log):',
          payload.type ?? 'Error',
          payload.value ?? '',
          payload.stacktrace ?? '',
        )
      }

      // Redact auth tokens from the page URL if present
      if (event.meta?.page?.url) {
        try {
          const url = new URL(event.meta.page.url)
          if (url.searchParams.has('token')) {
            url.searchParams.set('token', '[REDACTED]')
            event.meta.page.url = url.toString()
          }
        } catch {
          // ignore malformed URLs
        }
      }

      // Redact PII from error, exception, and log payloads before they reach the collector
      if (event.type === TransportItemType.EXCEPTION || event.type === TransportItemType.LOG) {
        const payloadStr = JSON.stringify(event.payload)
        const redacted = payloadStr
          // Redact sensitive query parameters and form values
          .replace(/email=[^&\s"']*/gi, 'email=[REDACTED]')
          .replace(/password=[^&\s"']*/gi, 'password=[REDACTED]')
          .replace(/api-key=[^&\s"']*/gi, 'api-key=[REDACTED]')
          // Hash user identifiers (JSON keys, query params, or form fields)
          .replace(/(user[_-]?id["']?\s*[:=]\s*["']?)([^"&\s,}]+)/gi, (_match, prefix, id) => {
            return prefix + simpleHash(id)
          })
          // Strip query parameters from non-page URLs embedded in the payload
          .replace(/(https?:\/\/[^\s"']+)(?:\?[^\s"']*)/gi, '$1')

        try {
          event.payload = JSON.parse(redacted)
        } catch {
          // If parsing fails, leave payload unchanged to avoid data loss
        }
      }

      return event
    },
  })

  return faroInstance
}
