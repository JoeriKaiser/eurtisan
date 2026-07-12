import { getLocale } from '#/paraglide/runtime'

function coerceDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = getLocale()
  const key = `${locale}:${JSON.stringify(options)}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = Reflect.construct(Intl.DateTimeFormat, [locale, options]) as Intl.DateTimeFormat
    formatterCache.set(key, formatter)
  }
  return formatter
}

/** e.g. "May 31, 2026" */
export function formatDateLong(value: Date | string | number): string {
  return getFormatter({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026" (short month) */
export function formatDateShort(value: Date | string | number): string {
  return getFormatter({
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026, 4:30 PM" */
export function formatDateMediumTime(value: Date | string | number): string {
  return getFormatter({
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026" */
export function formatDateMedium(value: Date | string | number): string {
  return getFormatter({
    dateStyle: 'medium',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026, 04:30 PM" (long month + time) */
export function formatDateLongWithTime(value: Date | string | number): string {
  return getFormatter({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(coerceDate(value))
}
