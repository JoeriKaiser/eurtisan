// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

afterEach(() => {
  vi.useRealTimers()
})

describe('useCountdown', () => {
  it('counts down from an event and stops at zero', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCountdown())

    act(() => result.current.start(2))
    expect(result.current.remaining).toBe(2)

    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.remaining).toBe(1)

    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.remaining).toBe(0)
  })

  it('cleans up its interval when the owner unmounts', () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const { result, unmount } = renderHook(() => useCountdown())

    act(() => result.current.start(60))
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
