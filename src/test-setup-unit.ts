import { AsyncLocalStorage } from 'node:async_hooks'
import { expect } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import 'vitest-axe/extend-expect'

expect.extend(matchers)

process.env.E2E_TEST = 'false'

// Some unit tests reference browser globals (e.g. window.umami, window.location.href via Paraglide).
// Provide a minimal polyfill so they can run in the node environment.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { href: 'http://localhost:3000' },
  } as unknown as Window & typeof globalThis
}

// Provide a default mock Start request context in AsyncLocalStorage for unit tests that invoke server functions directly.
const GLOBAL_START_STORAGE_KEY = Symbol.for('tanstack-start:start-storage-context')
const globalStorageObj = globalThis as typeof globalThis & {
  [GLOBAL_START_STORAGE_KEY]?: AsyncLocalStorage<unknown>
}
if (!globalStorageObj[GLOBAL_START_STORAGE_KEY]) {
  globalStorageObj[GLOBAL_START_STORAGE_KEY] = new AsyncLocalStorage()
}
const startStorage = globalStorageObj[GLOBAL_START_STORAGE_KEY]
if (startStorage) {
  const originalGetStore = startStorage.getStore.bind(startStorage)
  startStorage.getStore = () => {
    const existing = originalGetStore()
    if (existing) return existing
    return {
      request: new Request('http://localhost:3000'),
      getRouter: () => ({}),
      startOptions: {},
      contextAfterGlobalMiddlewares: {},
      handlerType: 'serverFn',
    }
  }
}
