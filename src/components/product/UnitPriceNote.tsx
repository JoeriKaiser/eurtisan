import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { deriveUnitPriceCents, type UnitPriceBasis } from '#/lib/products/unit-pricing'

export interface UnitPriceNoteProps {
  priceCents: number
  soldBy: UnitPriceBasis | null
  weightGrams: number | null
  volumeMl: number | null
  className?: string
}

/**
 * Directive 98/6/EC / arrêté of 16 November 1999: scoped products sold by
 * weight or volume must advertise the price per kg or per L beside the selling
 * price. Renders nothing when no declaration exists or the arrêté's Art. 6
 * waiver applies (net quantity exactly one kg/L).
 */
export function UnitPriceNote({
  priceCents,
  soldBy,
  weightGrams,
  volumeMl,
  className,
}: UnitPriceNoteProps) {
  const unitPriceCents = deriveUnitPriceCents({ soldBy, priceCents, weightGrams, volumeMl })
  if (unitPriceCents === null) return null

  return (
    <p className={className ?? 'text-xs text-text-muted'}>
      {soldBy === 'weight'
        ? m.unit_price_per_kg({ price: formatPriceEUR(unitPriceCents) })
        : m.unit_price_per_litre({ price: formatPriceEUR(unitPriceCents) })}
    </p>
  )
}
