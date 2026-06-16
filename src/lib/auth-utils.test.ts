import { describe, expect, it, vi } from 'vitest'
import { isLocalRedirect, safeRedirect, signMollieState, verifyMollieState } from './auth-utils'

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

describe('signMollieState / verifyMollieState', () => {
  it('round-trips a valid state for the matching user', () => {
    vi.useFakeTimers()
    const now = 1_700_000_000_000
    vi.setSystemTime(now)

    const state = signMollieState('shop-1', 'user-1')
    expect(verifyMollieState(state, 'user-1')).toBe('shop-1')

    vi.useRealTimers()
  })

  it('rejects a state for a different user', () => {
    const state = signMollieState('shop-1', 'user-1')
    expect(verifyMollieState(state, 'user-2')).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const state = signMollieState('shop-1', 'user-1')
    const tampered = `${state.slice(0, -4)}dead`
    expect(verifyMollieState(tampered, 'user-1')).toBeNull()
  })

  it('rejects an expired state', () => {
    vi.useFakeTimers()
    const now = 1_700_000_000_000
    vi.setSystemTime(now)
    const state = signMollieState('shop-1', 'user-1')

    vi.setSystemTime(now + 16 * 60 * 1000)
    expect(verifyMollieState(state, 'user-1')).toBeNull()

    vi.useRealTimers()
  })
})
