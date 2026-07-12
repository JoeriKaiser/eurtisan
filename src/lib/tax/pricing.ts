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
