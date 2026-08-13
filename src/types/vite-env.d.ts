/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public application origin embedded at build time */
  readonly VITE_PUBLIC_URL: string

  /** Public same-origin imgproxy base URL */
  readonly VITE_IMGPROXY_BASE_URL: string

  /** Public S3 bucket identifier used in imgproxy source paths */
  readonly VITE_S3_BUCKET: string

  /** URL of the Umami tracking script (e.g. https://analytics.example.com/script.js) */
  readonly VITE_UMAMI_ENABLED: 'true' | 'false'
  readonly VITE_UMAMI_SCRIPT_URL?: string

  /** Umami website ID (UUID) */
  readonly VITE_UMAMI_WEBSITE_ID?: string

  /**
   * Optional Umami API host URL when it differs from the script origin.
   * Falls back to the script URL origin when omitted.
   */
  readonly VITE_UMAMI_HOST_URL?: string

  /**
   * Optional SRI integrity hash for the Umami tracking script.
   * Generate with: openssl dgst -sha384 -binary <(curl -sL SCRIPT_URL) | openssl base64 -A
   */
  readonly VITE_UMAMI_SCRIPT_INTEGRITY?: string

  /** Grafana Faro collector/beacon URL (same-origin path or full URL) */
  readonly VITE_FARO_ENABLED: 'true' | 'false'
  readonly VITE_FARO_COLLECTOR_URL: string

  /** Application name reported to Grafana Faro */
  readonly VITE_FARO_APP_NAME: string

  /** Fraction of production sessions traced by Faro */
  readonly VITE_FARO_SAMPLE_RATE: string

  /** Runtime environment tag (e.g. development, staging, production) */
  readonly VITE_APP_ENV: 'development' | 'test' | 'staging' | 'production'

  /** Application release/version tag reported to observability tools */
  readonly VITE_APP_VERSION: string

  /** Whether analytics consent is required before Umami loads */
  readonly VITE_ANALYTICS_CONSENT_REQUIRED: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
