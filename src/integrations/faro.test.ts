// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ANALYTICS_CONSENT_CHANGE_EVENT } from '#/hooks/use-analytics-consent'

const faroMocks = vi.hoisted(() => ({
  beforeSend: undefined as ((event: Record<string, unknown>) => unknown) | undefined,
  initialize: vi.fn(),
  pause: vi.fn(),
  unpause: vi.fn(),
}))

vi.mock('@grafana/faro-web-sdk', () => ({
  getWebInstrumentations: () => [],
  initializeFaro: faroMocks.initialize,
  TransportItemType: { EXCEPTION: 'exception', LOG: 'log' },
}))

vi.mock('@grafana/faro-web-tracing', () => ({
  TracingInstrumentation: class TracingInstrumentation {},
}))

describe('Faro consent boundary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubEnv('VITE_FARO_ENABLED', 'true')
    vi.stubEnv('VITE_FARO_COLLECTOR_URL', '/collect')
    vi.stubEnv('VITE_FARO_APP_NAME', 'eurtisan')
    vi.stubEnv('VITE_FARO_SAMPLE_RATE', '1')
    vi.stubGlobal('navigator', { doNotTrack: '0' } as Navigator)
    faroMocks.initialize.mockImplementation(
      (config: { beforeSend?: typeof faroMocks.beforeSend }) => {
        faroMocks.beforeSend = config.beforeSend
        return {
          api: { pushEvent: vi.fn(), pushError: vi.fn() },
          pause: faroMocks.pause,
          unpause: faroMocks.unpause,
        }
      },
    )
  })

  it('does not initialize or send before consent and pauses immediately on revocation', async () => {
    const { initFaro } = await import('./faro')
    expect(initFaro()).toBeUndefined()
    expect(faroMocks.initialize).not.toHaveBeenCalled()

    localStorage.setItem('eurtisan_analytics_consent', 'granted')
    expect(initFaro()).toBeDefined()
    expect(faroMocks.initialize).toHaveBeenCalledTimes(1)

    localStorage.setItem('eurtisan_analytics_consent', 'denied')
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGE_EVENT))
    expect(faroMocks.pause).toHaveBeenCalledTimes(1)
  })

  it('drops post-revocation events and strips query data from page URLs', async () => {
    localStorage.setItem('eurtisan_analytics_consent', 'granted')
    const { initFaro } = await import('./faro')
    initFaro()

    const event = {
      type: 'event',
      payload: {},
      meta: { page: { url: 'https://eurtisan.eu/orders?token=secret&query=private#fragment' } },
    }
    expect(faroMocks.beforeSend?.(event)).toBe(event)
    expect(event.meta.page.url).toBe('https://eurtisan.eu/orders')

    localStorage.setItem('eurtisan_analytics_consent', 'denied')
    expect(faroMocks.beforeSend?.(event)).toBeNull()
  })
})
