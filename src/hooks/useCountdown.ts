import { useCallback, useState, useSyncExternalStore } from 'react'

interface CountdownStore {
  getSnapshot: () => number
  subscribe: (listener: () => void) => () => void
  start: (seconds: number) => void
}

function createCountdownStore(): CountdownStore {
  let deadline = 0
  let interval: ReturnType<typeof setInterval> | undefined
  const listeners = new Set<() => void>()

  const getSnapshot = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

  const stopInterval = () => {
    if (interval !== undefined) {
      clearInterval(interval)
      interval = undefined
    }
  }

  const emit = () => {
    for (const listener of listeners) listener()
    if (getSnapshot() === 0) stopInterval()
  }

  const ensureInterval = () => {
    if (interval === undefined && listeners.size > 0 && getSnapshot() > 0) {
      interval = setInterval(emit, 250)
    }
  }

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      ensureInterval()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopInterval()
      }
    },
    start(seconds) {
      deadline = Date.now() + Math.max(0, seconds) * 1000
      emit()
      ensureInterval()
    },
  }
}

export function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [store] = useState(createCountdownStore)
  const remaining = useSyncExternalStore(store.subscribe, store.getSnapshot, () => 0)
  const start = useCallback((seconds: number) => store.start(seconds), [store])

  return { remaining, start }
}
