import { initializeFaro, getWebInstrumentations, type Faro } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'

let faroInstance: Faro | undefined

export function getFaro(): Faro | undefined {
  return faroInstance
}

export function initFaro(): Faro | undefined {
  // Guard: SSR / Node.js / already initialized
  if (typeof window === 'undefined') return undefined
  if (faroInstance) return faroInstance

  const collectorUrl = import.meta.env.VITE_FARO_COLLECTOR_URL
  if (!collectorUrl) {
    console.warn('[Faro] VITE_FARO_COLLECTOR_URL is not set. RUM disabled.')
    return undefined
  }

  faroInstance = initializeFaro({
    url: collectorUrl,
    app: {
      name: import.meta.env.VITE_FARO_APP_NAME ?? 'eurtisan',
      version: import.meta.env.VITE_APP_VERSION ?? 'dev',
      environment: import.meta.env.VITE_APP_ENV ?? 'development',
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
      // Redact auth tokens from URLs if present
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
      return event
    },
  })

  return faroInstance
}
