import { describe, expect, it } from 'vitest'
import { formatPriceEUR } from './pricing'

describe('formatPriceEUR', () => {
  it('formats cents to EUR with comma decimal', () => {
    expect(formatPriceEUR(1250)).toBe('€12,50')
    expect(formatPriceEUR(9900)).toBe('€99,00')
    expect(formatPriceEUR(0)).toBe('€0,00')
    expect(formatPriceEUR(1)).toBe('€0,01')
    expect(formatPriceEUR(100000)).toBe('€1.000,00')
  })
})
