import { describe, expect, it } from 'vitest'

import { getSafeRequestPath } from './request-path.server'

describe('getSafeRequestPath', () => {
  it('returns the path unchanged when there is no query string', () => {
    expect(getSafeRequestPath('/foo')).toBe('/foo')
  })

  it('falls back to root when the url is empty or undefined', () => {
    expect(getSafeRequestPath('')).toBe('/')
    expect(getSafeRequestPath(undefined)).toBe('/')
  })

  it('redacts sensitive query values and leaves other params intact', () => {
    expect(getSafeRequestPath('/foo?token=secret&bar=1')).toBe('/foo?token=%5BREDACTED%5D&bar=1')
  })

  it('redacts multiple sensitive keys case-insensitively', () => {
    expect(getSafeRequestPath('/callback?CODE=abc&STATE=xyz&client=ok')).toBe(
      '/callback?CODE=%5BREDACTED%5D&STATE=%5BREDACTED%5D&client=ok',
    )
  })

  it('preserves non-sensitive query parameters', () => {
    expect(getSafeRequestPath('/search?q=pottery&page=2')).toBe('/search?q=pottery&page=2')
  })
})
