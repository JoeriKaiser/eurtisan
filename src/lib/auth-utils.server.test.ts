import { describe, expect, it, vi } from 'vitest'
import { signMollieState, verifyMollieState } from './auth-utils.server'

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
