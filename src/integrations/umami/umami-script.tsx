import { useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'

interface UmamiConfig {
  scriptUrl: string
  websiteId: string
  hostUrl?: string
  integrity?: string
}

function getUmamiConfig(): UmamiConfig | null {
  const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
  const hostUrl = import.meta.env.VITE_UMAMI_HOST_URL
  const integrity = import.meta.env.VITE_UMAMI_SCRIPT_INTEGRITY

  if (!scriptUrl || !websiteId) return null
  return { scriptUrl, websiteId, hostUrl, integrity }
}

/**
 * Renders the Umami tracking script when the required environment
 * variables are present and the user has granted analytics consent.
 * Respects Do Not Track automatically.
 */
export function UmamiScript() {
  const location = useLocation()
  const config = getUmamiConfig()
  const { consent } = useAnalyticsConsent()

  useEffect(() => {
    if (window.umami && location.pathname) {
      window.umami.track((props) => ({ ...props, url: location.pathname }))
    }
  }, [location.pathname])

  if (!config || consent !== 'granted') return null

  return (
    <script
      async
      defer
      src={config.scriptUrl}
      data-website-id={config.websiteId}
      data-do-not-track='true'
      crossOrigin='anonymous'
      {...(config.integrity ? { integrity: config.integrity } : {})}
      {...(config.hostUrl ? { 'data-host-url': config.hostUrl } : {})}
    />
  )
}
