// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnalyticsConsent } from './use-analytics-consent'

function createStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  }
}

describe('useAnalyticsConsent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('navigator', { doNotTrack: '0' } as Navigator)
  })

  it('returns null consent and shows banner when no choice has been made', () => {
    const { result } = renderHook(() => useAnalyticsConsent())
    expect(result.current.consent).toBeNull()
    expect(result.current.isRequired).toBe(true)
  })

  it('persists granted consent in localStorage', () => {
    const { result } = renderHook(() => useAnalyticsConsent())
    act(() => result.current.setConsent('granted'))
    expect(result.current.consent).toBe('granted')
    expect(localStorage.getItem('eurtisan_analytics_consent')).toBe('granted')
  })

  it('persists denied consent in localStorage', () => {
    const { result } = renderHook(() => useAnalyticsConsent())
    act(() => result.current.setConsent('denied'))
    expect(result.current.consent).toBe('denied')
    expect(localStorage.getItem('eurtisan_analytics_consent')).toBe('denied')
  })

  it('denies consent automatically when Do Not Track is enabled', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' } as Navigator)
    const { result } = renderHook(() => useAnalyticsConsent())
    expect(result.current.consent).toBe('denied')
    expect(result.current.isRequired).toBe(false)
  })
})
