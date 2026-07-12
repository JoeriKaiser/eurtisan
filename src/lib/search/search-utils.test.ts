import { describe, expect, it } from 'vitest'
import { buildFilterString, escapeFilterValue, highlightMatches, parsePriceFilter } from './utils'

describe('escapeFilterValue', () => {
  it('escapes double quotes', () => {
    expect(escapeFilterValue('say "hello"')).toBe('say \\"hello\\"')
  })

  it('escapes backslashes', () => {
    expect(escapeFilterValue('C:\\path')).toBe('C:\\\\path')
  })

  it('leaves normal text alone', () => {
    expect(escapeFilterValue('ceramic mug')).toBe('ceramic mug')
  })
})

describe('buildFilterString', () => {
  it('builds an equality filter for booleans', () => {
    const result = buildFilterString([{ field: 'isActive', operator: 'eq', value: true }])
    expect(result).toBe('isActive = true')
  })

  it('builds an equality filter for numbers', () => {
    const result = buildFilterString([{ field: 'priceCents', operator: 'eq', value: 2999 }])
    expect(result).toBe('priceCents = 2999')
  })

  it('builds an equality filter for strings with escaping', () => {
    const result = buildFilterString([{ field: 'shopSlug', operator: 'eq', value: 'test"shop' }])
    expect(result).toBe('shopSlug = "test\\"shop"')
  })

  it('builds a range filter', () => {
    const result = buildFilterString([
      { field: 'priceCents', operator: 'gte', value: 1000 },
      { field: 'priceCents', operator: 'lte', value: 5000 },
    ])
    expect(result).toBe('priceCents >= 1000 AND priceCents <= 5000')
  })

  it('builds an IN filter', () => {
    const result = buildFilterString([
      { field: 'categorySlug', operator: 'in', value: ['pottery', 'textiles'] },
    ])
    expect(result).toBe('categorySlug IN ["pottery", "textiles"]')
  })

  it('skips empty string values', () => {
    const result = buildFilterString([
      { field: 'shopSlug', operator: 'eq', value: '' },
      { field: 'isActive', operator: 'eq', value: true },
    ])
    expect(result).toBe('isActive = true')
  })

  it('skips undefined/null values', () => {
    const result = buildFilterString([
      { field: 'shopSlug', operator: 'eq', value: undefined as unknown as string },
      { field: 'isActive', operator: 'eq', value: true },
    ])
    expect(result).toBe('isActive = true')
  })

  it('returns empty string when no valid conditions', () => {
    expect(buildFilterString([])).toBe('')
    expect(buildFilterString([{ field: 'x', operator: 'eq', value: '' }])).toBe('')
  })

  it('combines multiple conditions with AND', () => {
    const result = buildFilterString([
      { field: 'isActive', operator: 'eq', value: true },
      { field: 'shopSlug', operator: 'eq', value: 'test-shop' },
      { field: 'priceCents', operator: 'gte', value: 100 },
    ])
    expect(result).toBe('isActive = true AND shopSlug = "test-shop" AND priceCents >= 100')
  })
})

describe('highlightMatches', () => {
  it('wraps matching terms in mark tags', () => {
    const result = highlightMatches('Ceramic Vase', 'cer')
    expect(result).toBe('<mark>Cer</mark>amic Vase')
  })

  it('matches multiple terms', () => {
    const result = highlightMatches('Ceramic Vase Lamp', 'cer lamp')
    expect(result).toBe('<mark>Cer</mark>amic Vase <mark>Lamp</mark>')
  })

  it('is case-insensitive', () => {
    const result = highlightMatches('CERAMIC', 'cer')
    expect(result).toBe('<mark>CER</mark>AMIC')
  })

  it('returns original text when query is empty', () => {
    expect(highlightMatches('Hello', '')).toBe('Hello')
  })

  it('returns original text when no terms match', () => {
    expect(highlightMatches('Hello', 'xyz')).toBe('Hello')
  })

  it('escapes regex special characters in query terms', () => {
    const result = highlightMatches('Price: $10.00', '$10')
    expect(result).toBe('Price: <mark>$10</mark>.00')
  })
})

describe('parsePriceFilter', () => {
  it('parses min and max from filter string', () => {
    const result = parsePriceFilter('priceCents >= 1000 AND priceCents <= 5000')
    expect(result).toEqual({ minCents: 1000, maxCents: 5000 })
  })

  it('parses only min', () => {
    const result = parsePriceFilter('priceCents >= 2000')
    expect(result).toEqual({ minCents: 2000, maxCents: null })
  })

  it('parses only max', () => {
    const result = parsePriceFilter('priceCents <= 8000')
    expect(result).toEqual({ minCents: null, maxCents: 8000 })
  })

  it('returns nulls for empty string', () => {
    const result = parsePriceFilter('')
    expect(result).toEqual({ minCents: null, maxCents: null })
  })
})
