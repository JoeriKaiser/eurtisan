import { useCallback, useState, useSyncExternalStore } from 'react'

type TimeoutKey = string

interface TimeoutStore {
  subscribe: (listener: () => void) => () => void
  schedule: (key: TimeoutKey, callback: () => void, delayMs: number) => void
  cancel: (key: TimeoutKey) => void
}

function createTimeoutStore(): TimeoutStore {
  const timers = new Map<TimeoutKey, ReturnType<typeof setTimeout>>()
  let owners = 0

  const cancel = (key: TimeoutKey) => {
    const timer = timers.get(key)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(key)
  }

  return {
    subscribe() {
      owners++
      return () => {
        owners--
        if (owners === 0) {
          for (const timer of timers.values()) clearTimeout(timer)
          timers.clear()
        }
      }
    },
    schedule(key, callback, delayMs) {
      cancel(key)
      const timer = setTimeout(() => {
        timers.delete(key)
        callback()
      }, delayMs)
      timers.set(key, timer)
    },
    cancel,
  }
}

const getSnapshot = () => 0

export function useManagedTimeouts(): {
  schedule: (key: TimeoutKey, callback: () => void, delayMs: number) => void
  cancel: (key: TimeoutKey) => void
} {
  const [store] = useState(createTimeoutStore)
  useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)

  return {
    schedule: useCallback(
      (key: TimeoutKey, callback: () => void, delayMs: number) =>
        store.schedule(key, callback, delayMs),
      [store],
    ),
    cancel: useCallback((key: TimeoutKey) => store.cancel(key), [store]),
  }
}
