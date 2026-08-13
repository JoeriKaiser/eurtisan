import { describe, expect, it } from 'vitest'
import { isLocalRedirect, safeRedirect } from './auth-utils'

describe('isLocalRedirect', () => {
  it('allows local absolute paths', () => {
    expect(isLocalRedirect('/')).toBe(true)
    expect(isLocalRedirect('/dashboard')).toBe(true)
    expect(isLocalRedirect('/shop/123')).toBe(true)
  })

  it('rejects protocol-relative URLs', () => {
    expect(isLocalRedirect('//evil.com')).toBe(false)
    expect(isLocalRedirect('//evil.com/steal')).toBe(false)
  })

  it('rejects absolute URLs', () => {
    expect(isLocalRedirect('https://evil.com')).toBe(false)
    expect(isLocalRedirect('http://evil.com')).toBe(false)
  })

  it('rejects relative paths without leading slash', () => {
    expect(isLocalRedirect('dashboard')).toBe(false)
    expect(isLocalRedirect('../admin')).toBe(false)
  })
})

describe('safeRedirect', () => {
  it('returns a valid local redirect', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard')
  })

  it('falls back to / when the value is null', () => {
    expect(safeRedirect(null)).toBe('/')
  })

  it('falls back to / for external URLs', () => {
    expect(safeRedirect('https://evil.com')).toBe('/')
  })

  it('falls back to / for protocol-relative URLs', () => {
    expect(safeRedirect('//evil.com')).toBe('/')
  })
})
