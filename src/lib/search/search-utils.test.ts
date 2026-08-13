import { describe, expect, it } from 'vitest'
import { escapeFilterValue, normalizeQueryForAnalytics } from './utils'

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

  it('neutralises a trailing backslash that would escape the closing quote', () => {
    // Unescaped, `categorySlug = "pottery\"` is an unterminated string literal.
    expect(`"${escapeFilterValue('pottery\\')}"`).toBe('"pottery\\\\"')
  })
})

describe('normalizeQueryForAnalytics', () => {
  it('lowercases and collapses whitespace so variants group together', () => {
    expect(normalizeQueryForAnalytics('  Ceramic   MUG ')).toBe('ceramic mug')
  })

  it('returns an empty string for a blank query', () => {
    expect(normalizeQueryForAnalytics('   ')).toBe('')
  })

  it('truncates a pathological query', () => {
    expect(normalizeQueryForAnalytics('a'.repeat(500))).toHaveLength(100)
  })
})
