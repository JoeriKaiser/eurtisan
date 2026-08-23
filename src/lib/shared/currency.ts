export const SUPPORTED_CURRENCY = 'EUR' as const
export type SupportedCurrency = typeof SUPPORTED_CURRENCY

/**
 * Safely parses a user-entered monetary amount string into integer cents.
 * Supports both European comma (14,50) and dot (14.50) decimal separators,
 * and strips whitespace and currency symbols.
 * Returns 0 if invalid or empty.
 */
export function parseDecimalCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) return 0
    return Math.round(value * 100)
  }
  const clean = value.replace(/[^0-9,.-]/g, '').trim()
  if (!clean) return 0

  let normalized = clean
  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      // European format: 1.234,50
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      // US format: 1,234.50
      normalized = normalized.replace(/,/g, '')
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  }

  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100)
}
