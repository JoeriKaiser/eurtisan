interface UmamiConfig {
  scriptUrl: string
  websiteId: string
  hostUrl?: string
}

function getUmamiConfig(): UmamiConfig | null {
  const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
  const hostUrl = import.meta.env.VITE_UMAMI_HOST_URL

  if (!scriptUrl || !websiteId) return null
  return { scriptUrl, websiteId, hostUrl }
}

/**
 * Renders the Umami tracking script when the required environment
 * variables are present. Safe to render on both server and client;
 * it returns `null` when Umami is not configured so it produces no
 * markup in development or when disabled.
 */
export function UmamiScript() {
  const config = getUmamiConfig()
  if (!config) return null

  return (
    <script
      async
      defer
      src={config.scriptUrl}
      data-website-id={config.websiteId}
      data-do-not-track='true'
      {...(config.hostUrl ? { 'data-host-url': config.hostUrl } : {})}
    />
  )
}
