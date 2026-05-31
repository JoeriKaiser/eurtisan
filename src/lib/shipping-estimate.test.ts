import { describe, expect, it } from 'vitest'
import { calculatePackageDimensions, calculatePackageWeight } from './shipping-estimate'

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
