// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { isLocalRedirect } from '#/lib/auth-utils'

describe('isLocalRedirect', () => {
  it('accepts root-relative paths', () => {
    expect(isLocalRedirect('/')).toBe(true)
    expect(isLocalRedirect('/checkout')).toBe(true)
    expect(isLocalRedirect('/orders/123/success')).toBe(true)
    expect(isLocalRedirect('/cart?tab=items')).toBe(true)
  })

  it('rejects protocol-relative URLs', () => {
    expect(isLocalRedirect('//evil.com')).toBe(false)
    expect(isLocalRedirect('//evil.com/steal')).toBe(false)
  })

  it('rejects absolute URLs', () => {
    expect(isLocalRedirect('https://evil.com')).toBe(false)
    expect(isLocalRedirect('http://localhost:3000')).toBe(false)
    expect(isLocalRedirect('https://example.com/checkout')).toBe(false)
  })

  it('rejects empty or non-path strings', () => {
    expect(isLocalRedirect('')).toBe(false)
    expect(isLocalRedirect('checkout')).toBe(false)
    expect(isLocalRedirect('javascript:alert(1)')).toBe(false)
  })
})
