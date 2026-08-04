import z from 'zod'

/**
 * Unit pricing under Directive 98/6/EC, as transposed in France (the
 * establishment state). The Directive lets Member States limit the non-food
 * obligation to a positive list (Art. 5(2)); France's is the annex of the
 * arrêté of 16 November 1999 (NOR ECOC9900157A), which lists, among others,
 * toilet soaps, soaps, and bath-and-shower products — i.e. the Soap & Bath
 * category. Candles, textiles, and every other category are not listed.
 *
 * The scope decision is made once, at write time, against the product's
 * category chain; the public surfaces then render purely from the product's
 * own `soldBy`/`volumeMl`/`weightGrams`, never by re-deriving scope.
 */

/** Top-level category slugs whose products fall within the Annex II list. */
const UNIT_PRICE_SCOPED_ROOT_SLUGS: Record<string, true> = { 'soap-bath': true }

export const unitPriceBasisSchema = z.enum(['weight', 'volume'])

export type UnitPriceBasis = z.infer<typeof unitPriceBasisSchema>

/**
 * Whether any category in the product's chain (leaf to root) is scoped.
 * The chain is passed as slugs, leaf first.
 */
export function isUnitPricingScoped(categoryChainSlugs: ReadonlyArray<string | null>): boolean {
  return categoryChainSlugs.some((slug) => slug !== null && slug in UNIT_PRICE_SCOPED_ROOT_SLUGS)
}

/**
 * The unit price in cents per kilogram (weight basis) or per litre (volume
 * basis), VAT included — the selling price already is. Returns null when the
 * product carries no basis or the matching quantity, and when the net
 * quantity is exactly one kilogram or one litre: the arrêté's Art. 6 waives
 * the unit price then, because it would equal the selling price.
 */
export function deriveUnitPriceCents(options: {
  soldBy: UnitPriceBasis | null | undefined
  priceCents: number
  weightGrams: number | null | undefined
  volumeMl: number | null | undefined
}): number | null {
  const { soldBy, priceCents, weightGrams, volumeMl } = options
  if (soldBy === 'weight') {
    if (weightGrams == null || weightGrams <= 0) return null
    if (weightGrams === 1000) return null
    return Math.round((priceCents * 1000) / weightGrams)
  }
  if (soldBy === 'volume') {
    if (volumeMl == null || volumeMl <= 0) return null
    if (volumeMl === 1000) return null
    return Math.round((priceCents * 1000) / volumeMl)
  }
  return null
}

/**
 * A scoped product is complete when it declares a basis and the quantity that
 * basis prices. Incomplete legacy rows must not display a computed unit price
 * and are flagged to the seller instead.
 */
export function unitPricingMissing(options: {
  scoped: boolean
  soldBy: UnitPriceBasis | null | undefined
  weightGrams: number | null | undefined
  volumeMl: number | null | undefined
}): boolean {
  if (!options.scoped) return false
  if (options.soldBy === 'weight') return options.weightGrams == null
  if (options.soldBy === 'volume') return options.volumeMl == null
  return true
}
