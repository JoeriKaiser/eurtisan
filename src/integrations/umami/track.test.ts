// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent, trackPageView } from './track'

describe('trackEvent', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('eurtisan_analytics_consent', 'granted')
  })

  it('returns undefined when window.umami is not available', async () => {
    const result = await trackEvent('test-event')
    expect(result).toBeUndefined()
  })

  it('does not call a loaded Umami client without current consent', async () => {
    localStorage.setItem('eurtisan_analytics_consent', 'denied')
    const track = vi.fn().mockResolvedValue('ok')
    window.umami = { track }

    expect(await trackEvent('test-event')).toBeUndefined()
    expect(track).not.toHaveBeenCalled()
    delete window.umami
  })

  it('calls window.umami.track and returns the result', async () => {
    const track = vi.fn().mockResolvedValue('ok')
    window.umami = { track }

    const result = await trackEvent('test-event', { foo: 'bar' })

    expect(track).toHaveBeenCalledWith('test-event', { foo: 'bar' })
    expect(result).toBe('ok')

    delete window.umami
  })

  it('tracks page views without URL query parameters or fragments', async () => {
    window.history.replaceState({}, '', '/products?token=secret#reviews')
    const track = vi.fn().mockResolvedValue('ok')
    window.umami = { track }

    expect(await trackPageView()).toBe('ok')
    const transform = track.mock.calls[0]?.[0]
    expect(typeof transform).toBe('function')
    expect(transform({ title: 'Product' })).toEqual({ title: 'Product', url: '/products' })

    delete window.umami
  })

  it('returns undefined when tracking throws', async () => {
    const track = vi.fn().mockRejectedValue(new Error('network'))
    window.umami = { track }

    const result = await trackEvent('test-event')

    expect(result).toBeUndefined()

    delete window.umami
  })
})
