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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
