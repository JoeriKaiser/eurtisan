import { describe, expect, it } from 'vitest'
import {
  calculatePackageDimensions,
  calculatePackageFromItems,
  calculatePackageWeight,
} from './estimate'

describe('calculatePackageWeight', () => {
  it('returns 500g per item', () => {
    expect(calculatePackageWeight(1)).toBe(500)
    expect(calculatePackageWeight(2)).toBe(1000)
    expect(calculatePackageWeight(5)).toBe(2500)
  })

  it('enforces a minimum of 100g', () => {
    expect(calculatePackageWeight(0)).toBe(100)
  })
})

describe('calculatePackageDimensions', () => {
  it('returns fixed length and height with variable width', () => {
    const dims1 = calculatePackageDimensions(1)
    expect(dims1.lengthCm).toBe(20)
    expect(dims1.widthCm).toBe(10) // minimum enforced
    expect(dims1.heightCm).toBe(15)

    const dims2 = calculatePackageDimensions(2)
    expect(dims2.lengthCm).toBe(20)
    expect(dims2.widthCm).toBe(10)
    expect(dims2.heightCm).toBe(15)

    const dims3 = calculatePackageDimensions(3)
    expect(dims3.lengthCm).toBe(20)
    expect(dims3.widthCm).toBe(15)
    expect(dims3.heightCm).toBe(15)
  })

  it('scales width linearly with item count', () => {
    const dims10 = calculatePackageDimensions(10)
    expect(dims10.widthCm).toBe(50)
  })
})

describe('calculatePackageFromItems', () => {
  it('sums weights and uses bounding-box dimensions when all fields are present', () => {
    const pkg = calculatePackageFromItems([
      { quantity: 2, weightGrams: 300, lengthCm: 20, widthCm: 15, heightCm: 10 },
      { quantity: 1, weightGrams: 500, lengthCm: 30, widthCm: 20, heightCm: 15 },
    ])

    expect(pkg.weightGrams).toBe(1100)
    expect(pkg.lengthCm).toBe(30)
    expect(pkg.widthCm).toBe(20)
    expect(pkg.heightCm).toBe(35) // 2 * 10 + 15
  })

  it('falls back to defaults for items missing dimensions', () => {
    const pkg = calculatePackageFromItems([
      { quantity: 1, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null },
    ])

    expect(pkg.weightGrams).toBe(500)
    expect(pkg.lengthCm).toBe(20)
    expect(pkg.widthCm).toBe(15)
    expect(pkg.heightCm).toBe(15)
  })

  it('mixes real and fallback dimensions correctly', () => {
    const pkg = calculatePackageFromItems([
      { quantity: 1, weightGrams: 250, lengthCm: 10, widthCm: 10, heightCm: 10 },
      { quantity: 1, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null },
    ])

    expect(pkg.weightGrams).toBe(750)
    expect(pkg.lengthCm).toBe(20)
    expect(pkg.widthCm).toBe(15)
    expect(pkg.heightCm).toBe(25)
  })

  it('enforces minimum package dimensions', () => {
    const pkg = calculatePackageFromItems([])

    expect(pkg.weightGrams).toBe(100)
    expect(pkg.lengthCm).toBe(10)
    expect(pkg.widthCm).toBe(10)
    expect(pkg.heightCm).toBe(5)
  })

  it('multiplies weight and height by quantity', () => {
    const pkg = calculatePackageFromItems([
      { quantity: 3, weightGrams: 200, lengthCm: 12, widthCm: 8, heightCm: 5 },
    ])

    expect(pkg.weightGrams).toBe(600)
    expect(pkg.heightCm).toBe(15)
  })
})
