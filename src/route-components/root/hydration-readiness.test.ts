// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { markDocumentHydrated } from './hydration-readiness'

describe('document hydration readiness', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-hydrated')
  })

  it('marks readiness after the React commit and removes it on cleanup', async () => {
    const onHydrated = vi.fn()
    document.documentElement.addEventListener('eurtisan:hydrated', onHydrated)

    const cleanup = markDocumentHydrated(document.body)

    expect(document.documentElement.hasAttribute('data-hydrated')).toBe(false)
    expect(onHydrated).not.toHaveBeenCalled()

    await Promise.resolve()

    expect(document.documentElement.getAttribute('data-hydrated')).toBe('true')
    expect(onHydrated).toHaveBeenCalledTimes(1)

    cleanup?.()
    expect(document.documentElement.hasAttribute('data-hydrated')).toBe(false)

    document.documentElement.removeEventListener('eurtisan:hydrated', onHydrated)
  })

  it('does not publish readiness after an immediate cleanup replay', async () => {
    const cleanup = markDocumentHydrated(document.body)
    cleanup?.()

    await Promise.resolve()

    expect(document.documentElement.hasAttribute('data-hydrated')).toBe(false)
  })
})
