import { describe, expect, it, vi } from 'vitest'
import { formatPriceEUR, parseEuroToCents } from './pricing'

let mockLocale = 'en'
vi.mock('#/paraglide/runtime', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
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

describe('parseEuroToCents', () => {
  it('accepts comma as decimal separator', () => {
    expect(parseEuroToCents('14,50')).toBe(1450)
    expect(parseEuroToCents('0,50')).toBe(50)
  })

  it('accepts dot as decimal separator', () => {
    expect(parseEuroToCents('14.50')).toBe(1450)
    expect(parseEuroToCents('14,5')).toBe(1450)
  })

  it('returns integer cents via a single rounding step', () => {
    expect(parseEuroToCents('7')).toBe(700)
    expect(parseEuroToCents('19,999')).toBe(2000)
  })

  it('maps zero to zero cents', () => {
    expect(parseEuroToCents('0,00')).toBe(0)
    expect(parseEuroToCents('0.00')).toBe(0)
  })

  it('rejects empty and blank input', () => {
    expect(parseEuroToCents('')).toBeNull()
    expect(parseEuroToCents('   ')).toBeNull()
  })

  it('rejects non-numeric input', () => {
    expect(parseEuroToCents('abc')).toBeNull()
    expect(parseEuroToCents('14,5x')).toBeNull()
  })

  it('ignores surrounding whitespace', () => {
    expect(parseEuroToCents('  9,99  ')).toBe(999)
  })

  it('keeps the sign so call sites apply their own validation', () => {
    expect(parseEuroToCents('-4,20')).toBe(-420)
  })

  it('treats every dot as a decimal point (no thousands separators)', () => {
    expect(parseEuroToCents('1.234')).toBe(123)
  })
})
