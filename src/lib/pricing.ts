/**
 * Format a price in cents to a EUR string using European formatting.
 * Examples: 1250 → "€12,50", 9900 → "€99,00"
 */
const priceFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPriceEUR(cents: number): string {
  return `€${priceFormatter.format(cents / 100)}`
}
