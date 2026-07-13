import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'eurtisan_analytics_consent'
const CONSENT_CHANGE_EVENT = 'eurtisan:analytics-consent-change'

export type AnalyticsConsent = 'granted' | 'denied' | null

function isDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes'
}

function readStoredConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'granted' || raw === 'denied') return raw
  } catch {
    // localStorage may be unavailable in private mode or with strict cookie blockers.
  }
  return null
}

function writeStoredConsent(consent: AnalyticsConsent): void {
  if (typeof window === 'undefined') return
  try {
    if (consent === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, consent)
    }
  } catch {
    // localStorage may be unavailable; the in-page event still updates consumers.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT))
}

function getConsentSnapshot(): AnalyticsConsent {
  return isDoNotTrack() ? 'denied' : readStoredConsent()
}

function subscribeToConsent(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onStoreChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange)
  }
}

/**
 * Cookie-less analytics consent store.
 *
 * - Returns `denied` automatically when Do Not Track is enabled.
 * - Persists the user's choice in localStorage.
 * - Returns `null` until the user has made a choice (banner should be shown).
 */
export function useAnalyticsConsent(): {
  consent: AnalyticsConsent
  setConsent: (consent: 'granted' | 'denied') => void
  isRequired: boolean
} {
  const consent = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => null)

  const setConsent = useCallback((value: 'granted' | 'denied') => {
    writeStoredConsent(value)
  }, [])

  const isRequired = import.meta.env.VITE_ANALYTICS_CONSENT_REQUIRED !== 'false' && !isDoNotTrack()

  return { consent, setConsent, isRequired }
}

/**
 * Server-safe check: returns true only when the user has explicitly granted
 * consent. Always returns false on the server.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  if (isDoNotTrack()) return false
  return readStoredConsent() === 'granted'
}
