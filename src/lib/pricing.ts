/**
 * Format a price in cents to a EUR string using European formatting.
 * Examples: 1250 → "€12,50", 9900 → "€99,00"
 */
export function formatPriceEUR(cents: number): string {
  const euros = cents / 100
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros)
  return `€${formatted}`
}
