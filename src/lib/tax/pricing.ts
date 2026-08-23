import { getLocale } from '#/paraglide/runtime'
import { SUPPORTED_CURRENCY } from '../currency'

const formatters = new Map<string, Intl.NumberFormat>()

export function formatPriceEUR(cents: number): string {
  let locale = 'en'
  try {
    locale = getLocale()
  } catch {
    // Fallback if URL is invalid or cannot be parsed (e.g., in test environments)
  }

  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = Reflect.construct(Intl.NumberFormat, [
      locale,
      {
        style: 'currency',
        currency: SUPPORTED_CURRENCY,
      },
    ]) as Intl.NumberFormat
    formatters.set(locale, formatter)
  }
  return formatter.format(cents / 100)
}

/**
 * Parses a user-entered euro amount into integer cents.
 *
 * Accepts both `,` and `.` as the decimal separator; the input is trimmed and
 * `,` is normalized to `.` before parsing. Thousands separators are
 * intentionally NOT supported and a `.` always means a decimal point, so
 * `'1.234'` parses as €1.23 (123 cents), never €1,234.
 *
 * Returns `null` for empty or non-numeric input. Sign validation is left to
 * the call site so each flow keeps its own error semantics (e.g. prices must
 * be positive, refund filters reject negatives).
 */
export function parseEuroToCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (normalized === '') return null
  const euros = Number(normalized)
  if (!Number.isFinite(euros)) return null
  return Math.round(euros * 100)
}
