/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL of the Umami tracking script (e.g. https://analytics.example.com/script.js) */
  readonly VITE_UMAMI_SCRIPT_URL?: string

  /** Umami website ID (UUID) */
  readonly VITE_UMAMI_WEBSITE_ID?: string

  /**
   * Optional Umami API host URL when it differs from the script origin.
   * Falls back to the script URL origin when omitted.
   */
  readonly VITE_UMAMI_HOST_URL?: string

  /** Meilisearch host URL exposed to the browser (e.g. https://search.example.com) */
  readonly VITE_MEILISEARCH_HOST?: string

  /**
   * Meilisearch search-only API key exposed to the browser.
   * Must have restricted permissions (search only, specific indexes).
   * Never use the master key here.
   */
  readonly VITE_MEILISEARCH_SEARCH_KEY?: string

  /** Grafana Faro collector/beacon URL (same-origin path or full URL) */
  readonly VITE_FARO_COLLECTOR_URL?: string

  /** Application name reported to Grafana Faro */
  readonly VITE_FARO_APP_NAME?: string

  /** Runtime environment tag (e.g. development, staging, production) */
  readonly VITE_APP_ENV?: string

  /** Application release/version tag reported to observability tools */
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
