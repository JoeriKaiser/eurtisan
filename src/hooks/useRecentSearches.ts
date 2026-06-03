import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'eurtisan_recent_searches'
const MAX_ENTRIES = 8

let cachedRaw: string | null = null
let cachedParsed: string[] = []

function parseSearches(raw: string | null): string[] {
  if (raw === cachedRaw) return cachedParsed
  cachedRaw = raw

  if (!raw) {
    cachedParsed = []
    return cachedParsed
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      cachedParsed = parsed.slice(0, MAX_ENTRIES)
      return cachedParsed
    }
    cachedParsed = []
    return cachedParsed
  } catch {
    cachedParsed = []
    return cachedParsed
  }
}

const EMPTY_ARRAY: string[] = []

function getSnapshot(): string[] {
  if (typeof window === 'undefined') return EMPTY_ARRAY
  return parseSearches(window.localStorage.getItem(STORAGE_KEY))
}

function getServerSnapshot(): string[] {
  return EMPTY_ARRAY
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback()
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

export function useRecentSearches() {
  const searches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addSearch = useCallback((query: string) => {
    if (typeof window === 'undefined') return
    const trimmed = query.trim()
    if (!trimmed) return

    const current = getSnapshot()
    const next = [
      trimmed,
      ...current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    // Invalidate cache so next getSnapshot picks up the change
    cachedRaw = null
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  const removeSearch = useCallback((query: string) => {
    if (typeof window === 'undefined') return
    const current = getSnapshot()
    const next = current.filter((s) => s !== query)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    cachedRaw = null
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  const clearSearches = useCallback(() => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(STORAGE_KEY)
    cachedRaw = null
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  return { searches, addSearch, removeSearch, clearSearches }
}
