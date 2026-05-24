import { describe, expect, it, vi } from 'vitest'
import { trackEvent } from './track'

describe('trackEvent', () => {
  it('returns undefined when window.umami is not available', async () => {
    const result = await trackEvent('test-event')
    expect(result).toBeUndefined()
  })

  it('calls window.umami.track and returns the result', async () => {
    const track = vi.fn().mockResolvedValue('ok')
    window.umami = { track }

    const result = await trackEvent('test-event', { foo: 'bar' })

    expect(track).toHaveBeenCalledWith('test-event', { foo: 'bar' })
    expect(result).toBe('ok')

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
