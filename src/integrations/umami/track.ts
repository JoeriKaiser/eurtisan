import type { UmamiClient } from './types'

function getUmamiClient(): UmamiClient | undefined {
  if (typeof window === 'undefined') return undefined
  return window.umami
}

/**
 * Track a custom event with Umami.
 *
 * Returns `undefined` silently when Umami is not configured or the script
 * has not loaded yet. Tracking failures are swallowed so that analytics
 * can never break user-facing functionality.
 */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
): Promise<string | undefined> {
  const umami = getUmamiClient()
  if (!umami) {
    return Promise.resolve(undefined)
  }
  return umami.track(eventName, eventData).catch(() => undefined)
}
