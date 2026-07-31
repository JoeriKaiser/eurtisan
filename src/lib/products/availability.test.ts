import { describe, expect, it } from 'vitest'
import { resolveAvailability } from './availability'

describe('resolveAvailability', () => {
  it('reports out of stock at zero', () => {
    expect(resolveAvailability(0, 5)).toEqual({ kind: 'out_of_stock' })
  })

  it('treats a negative count as out of stock rather than low', () => {
    // Stock should never go negative, but an oversell race is the one place it
    // could — and "Only -1 left" would be the worst possible way to find out.
    expect(resolveAvailability(-2, 5)).toEqual({ kind: 'out_of_stock' })
  })

  it('counts the threshold itself as low', () => {
    // `<=`, matching how the low-stock notification job reads the same column.
    expect(resolveAvailability(5, 5)).toEqual({ kind: 'low_stock', count: 5 })
  })

  it('is plain in-stock above the threshold', () => {
    expect(resolveAvailability(6, 5)).toEqual({ kind: 'in_stock' })
  })

  it("follows the seller's threshold rather than a fixed number", () => {
    // The same count reads differently for a maker who restocks weekly and one
    // who makes four a year. That is the whole reason this takes a threshold.
    expect(resolveAvailability(4, 10)).toEqual({ kind: 'low_stock', count: 4 })
    expect(resolveAvailability(4, 2)).toEqual({ kind: 'in_stock' })
  })

  it('never treats a zero threshold as making everything low', () => {
    expect(resolveAvailability(1, 0)).toEqual({ kind: 'in_stock' })
  })
})
