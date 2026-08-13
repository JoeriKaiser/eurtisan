import { describe, expect, it } from 'vitest'
import { generateOrderNumber, isValidOrderNumber } from './order-numbers'

describe('order-numbers', () => {
  describe('generateOrderNumber', () => {
    it('generates an 8-character string', () => {
      const result = generateOrderNumber()
      expect(result).toHaveLength(8)
    })

    it('only uses characters from the unambiguous alphabet', () => {
      const result = generateOrderNumber()
      expect(result).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
    })

    it('generates different values across calls', () => {
      const results = new Set(Array.from({ length: 20 }, () => generateOrderNumber()))
      expect(results.size).toBeGreaterThan(15)
    })

    it('never includes visually ambiguous characters', () => {
      for (let i = 0; i < 50; i++) {
        const result = generateOrderNumber()
        expect(result).not.toMatch(/[0O1I]/)
      }
    })
  })

  describe('isValidOrderNumber', () => {
    it('returns true for a valid order number', () => {
      expect(isValidOrderNumber('A2B4C6D8')).toBe(true)
    })

    it('returns false for ambiguous characters', () => {
      expect(isValidOrderNumber('O2B4C6D8')).toBe(false)
      expect(isValidOrderNumber('01234567')).toBe(false)
      expect(isValidOrderNumber('ABCDEFIH')).toBe(false) // contains I
      expect(isValidOrderNumber('A1B2C3D4')).toBe(false)
    })

    it('returns false for wrong lengths', () => {
      expect(isValidOrderNumber('A2B4C6D')).toBe(false)
      expect(isValidOrderNumber('A2B4C6D8E')).toBe(false)
    })

    it('returns false for non-strings', () => {
      expect(isValidOrderNumber(null)).toBe(false)
      expect(isValidOrderNumber(12345678)).toBe(false)
      expect(isValidOrderNumber(undefined)).toBe(false)
    })
  })
})
