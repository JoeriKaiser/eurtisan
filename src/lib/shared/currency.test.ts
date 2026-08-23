import { describe, expect, it } from 'vitest'
import { parseDecimalCents } from './currency'

describe('parseDecimalCents', () => {
  it('parses standard dot decimal numbers', () => {
    expect(parseDecimalCents('14.50')).toBe(1450)
    expect(parseDecimalCents('0.99')).toBe(99)
    expect(parseDecimalCents('100.00')).toBe(10000)
    expect(parseDecimalCents('5')).toBe(500)
  })

  it('parses European comma decimal numbers', () => {
    expect(parseDecimalCents('14,50')).toBe(1450)
    expect(parseDecimalCents('0,99')).toBe(99)
    expect(parseDecimalCents('100,00')).toBe(10000)
    expect(parseDecimalCents('1.250,50')).toBe(125050)
  })

  it('handles whitespace, currency symbols and numeric types', () => {
    expect(parseDecimalCents(' € 14,50 ')).toBe(1450)
    expect(parseDecimalCents('14,50€')).toBe(1450)
    expect(parseDecimalCents(14.5)).toBe(1450)
    expect(parseDecimalCents(0)).toBe(0)
    expect(parseDecimalCents('')).toBe(0)
    expect(parseDecimalCents(null)).toBe(0)
    expect(parseDecimalCents(undefined)).toBe(0)
    expect(parseDecimalCents('abc')).toBe(0)
  })
})
