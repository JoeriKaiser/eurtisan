import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPublicUrl } from './public-url'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getPublicUrl', () => {
  it('returns the configured PUBLIC_URL', () => {
    vi.stubEnv('PUBLIC_URL', 'https://eurtisan.example')

    expect(getPublicUrl()).toBe('https://eurtisan.example')
  })

  it('returns an empty string when PUBLIC_URL is not configured', () => {
    vi.stubEnv('PUBLIC_URL', '')

    expect(getPublicUrl()).toBe('')
  })

  it('reads PUBLIC_URL when called rather than at module initialization', () => {
    vi.stubEnv('PUBLIC_URL', 'https://first.example')
    expect(getPublicUrl()).toBe('https://first.example')

    vi.stubEnv('PUBLIC_URL', 'https://second.example')
    expect(getPublicUrl()).toBe('https://second.example')
  })
})
