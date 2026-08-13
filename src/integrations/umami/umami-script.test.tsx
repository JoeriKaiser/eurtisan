// @vitest-environment jsdom

import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ANALYTICS_CONSENT_CHANGE_EVENT } from '#/hooks/use-analytics-consent'
import { UmamiScript } from './umami-script'

function setConsent(value: 'granted' | 'denied') {
  localStorage.setItem('eurtisan_analytics_consent', value)
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT))
}

describe('UmamiScript', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_UMAMI_ENABLED', 'true')
    vi.stubEnv('VITE_UMAMI_SCRIPT_URL', 'https://analytics.example.test/script.js')
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'website-1')
  })

  it('does not load the optional script before a consent choice', () => {
    const { container } = render(<UmamiScript />)
    expect(container.querySelector('script')).toBeNull()
  })

  it('does not load the optional script after rejection', () => {
    setConsent('denied')
    const { container } = render(<UmamiScript />)
    expect(container.querySelector('script')).toBeNull()
  })

  it('loads only after consent and disables Umami automatic tracking', () => {
    setConsent('granted')
    const { container } = render(<UmamiScript />)
    const script = container.querySelector('script')

    expect(script?.getAttribute('src')).toBe('https://analytics.example.test/script.js')
    expect(script?.getAttribute('data-auto-track')).toBe('false')
    expect(script?.getAttribute('data-do-not-track')).toBe('true')
  })

  it('removes the script after consent is revoked', () => {
    setConsent('granted')
    const { container } = render(<UmamiScript />)
    expect(container.querySelector('script')).not.toBeNull()

    act(() => setConsent('denied'))
    expect(container.querySelector('script')).toBeNull()
  })
})
