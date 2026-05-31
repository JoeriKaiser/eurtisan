import { getLocale } from '#/paraglide/runtime'

const formatters: Record<string, Intl.NumberFormat> = {}

export function formatPriceEUR(cents: number): string {
  let locale = 'en'
  try {
    locale = getLocale()
  } catch {
    // Fallback if URL is invalid or cannot be parsed (e.g., in test environments)
  }

  if (!formatters[locale]) {
    formatters[locale] = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    })
  }
  return formatters[locale].format(cents / 100)
}
