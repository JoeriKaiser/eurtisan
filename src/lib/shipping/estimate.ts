import type { Package, PackageItem } from './types'

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

/* -------------------------------------------------------------------------- */
/*                         Real product dimensions                            */
/* -------------------------------------------------------------------------- */

const DEFAULT_LENGTH_CM = 20
const DEFAULT_WIDTH_CM = 15

function getItemPackage(item: PackageItem) {
  const count = item.quantity
  return {
    quantity: count,
    weightGrams:
      item.weightGrams != null ? item.weightGrams * count : calculatePackageWeight(count),
    lengthCm: item.lengthCm ?? DEFAULT_LENGTH_CM,
    widthCm: item.widthCm ?? DEFAULT_WIDTH_CM,
    heightCm:
      item.heightCm != null ? item.heightCm * count : calculatePackageDimensions(count).heightCm,
  }
}

/**
 * Build a shipping package from order/cart items.
 *
 * - Weight is summed across all items (weight × quantity).
 * - Dimensions use a bounding-box heuristic: max length, max width, sum of heights.
 * - Missing dimensions fall back to sensible defaults per item so checkout never breaks.
 */
export function calculatePackageFromItems(items: PackageItem[]): Package {
  if (items.length === 0) {
    return { weightGrams: 100, lengthCm: 10, widthCm: 10, heightCm: 5 }
  }

  const packages = items.map(getItemPackage)

  return {
    weightGrams: Math.max(
      100,
      packages.reduce((sum, p) => sum + p.weightGrams, 0),
    ),
    lengthCm: Math.max(10, Math.max(...packages.map((p) => p.lengthCm))),
    widthCm: Math.max(10, Math.max(...packages.map((p) => p.widthCm))),
    heightCm: Math.max(
      5,
      packages.reduce((sum, p) => sum + p.heightCm, 0),
    ),
  }
}

export type { PackageItem }
