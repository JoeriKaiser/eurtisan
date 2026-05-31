/**
 * Shared package weight/dimension estimates used by both checkout
 * (shipping-rate quotes) and label generation so the two systems
 * never diverge.
 */

/** Per-item weight in grams with a sensible minimum. */
export function calculatePackageWeight(itemCount: number): number {
  return Math.max(100, itemCount * 500)
}

/** Per-item dimensions in centimetres with a sensible minimum width. */
export function calculatePackageDimensions(itemCount: number) {
  return {
    lengthCm: 20,
    widthCm: Math.max(10, itemCount * 5),
    heightCm: 15,
  }
}
