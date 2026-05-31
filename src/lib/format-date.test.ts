import { describe, expect, it, vi } from 'vitest'
import { formatDateLong, formatDateMedium } from './format-date'

vi.mock('#/paraglide/runtime', () => ({
  getLocale: () => 'en',
}))

describe('formatDate', () => {
  it('formats using the active Paraglide locale', () => {
    const formatted = formatDateLong(new Date('2026-05-31T12:00:00Z'))
    expect(formatted).toContain('2026')
    expect(formatted).toMatch(/May|31/)
  })

  it('supports medium date style', () => {
    expect(formatDateMedium('2026-01-15T10:00:00Z')).toContain('2026')
  })
})
