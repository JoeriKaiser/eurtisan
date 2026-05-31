import { describe, expect, it, vi } from 'vitest'
import { formatPriceEUR } from './pricing'

let mockLocale = 'en'
vi.mock('#/paraglide/runtime', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    getLocale: () => mockLocale,
  }
})

describe('formatPriceEUR', () => {
  it('formats cents to EUR with locale-aware format', () => {
    mockLocale = 'en'
    expect(formatPriceEUR(1250)).toBe('€12.50')
    expect(formatPriceEUR(9900)).toBe('€99.00')
    expect(formatPriceEUR(0)).toBe('€0.00')
    expect(formatPriceEUR(1)).toBe('€0.01')
    expect(formatPriceEUR(100000)).toBe('€1,000.00')

    mockLocale = 'fr'
    // Normalize spaces to standard space for comparisons
    expect(formatPriceEUR(1250).replace(/[\s\u00A0\u202F]/g, ' ')).toBe('12,50 €')
    expect(formatPriceEUR(100000).replace(/[\s\u00A0\u202F]/g, ' ')).toBe('1 000,00 €')

    mockLocale = 'de'
    expect(formatPriceEUR(1250).replace(/[\s\u00A0\u202F]/g, ' ')).toBe('12,50 €')
    expect(formatPriceEUR(100000).replace(/[\s\u00A0\u202F]/g, ' ')).toBe('1.000,00 €')
  })
})
